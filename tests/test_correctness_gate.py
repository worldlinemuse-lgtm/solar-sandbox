"""Model-correctness gate: per-minute invariants and all 25 historical winters.

Run: python tests/test_correctness_gate.py
CHROMIUM_BIN may point to a system Chromium executable.
These are historical stress tests, not probabilities of future outages.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "tests" / "correctness_results.json"

def main():
    with sync_playwright() as pw:
        options = {"headless": True}
        if os.getenv("CHROMIUM_BIN"):
            options["executable_path"] = os.environ["CHROMIUM_BIN"]
        browser = pw.chromium.launch(**options)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.set_content((ROOT / "index.html").read_text(encoding="utf-8"), timeout=60000)
        checks = page.evaluate("""()=> {
          const S=SIM.S,c=S.cfg,all=[];SIM.setPlaying(false);
          const cases=[
            {id:'ordinary',wx:'tmy',soc:.82,pv:true,gen:false,loads:[120,400,45]},
            {id:'winter',wx:'w2023',soc:.25,pv:true,gen:false,loads:[120,400,45]},
            {id:'incompatible-240',wx:'tmy',soc:1,pv:true,gen:false,loads:[1000],voltage:240},
            {id:'manual-generator',wx:'w2021',soc:.12,pv:false,gen:true,manual:true,loads:[700,45]},
            {id:'attended-limited-fuel',wx:'w2020',soc:.12,pv:false,gen:true,manual:false,loads:[700,45]},
            {id:'no-panels',wx:'w2014',soc:.4,pv:false,gen:false,loads:[400]}
          ];
          for(const x of cases) {
            SIM.setWeather(x.wx);c.inv='m24-3000';c.genOn=x.gen;
            c.genMode=x.manual?'manual':'attended';c.genFuel=x.gen?.95:0;
            S.genFuelLeft=c.genFuel;S.genRun=false;
            S.loads=x.loads.map((w,i)=>({id:'check'+i,name:'Test '+i,short:'T',w,
              qty:1,surge:1,volt:x.voltage||120,leg:1,mode:'on',wins:[[0,0]],off:0}));
            SIM.cfgChanged(true,true);S.t=305*1440;S.soc=x.soc;
            S.invOn=true;S.invTrip=false;S.invLow=false;S.bmsTrip=false;
            S.mpptDead=false;S.pvOpen=!x.pv;S.prevOn={};S.quiet=true;
            let bad=0,maxDemandError=0,maxAcError=0,fuelRises=0;
            const fuel0=S.genFuelLeft,stats0={...S.stats};
            for(let i=0;i<1440;i++){
              const fuel=S.genFuelLeft,st={...S.stats};SIM.step();
              const L=S.live;
              const demandErr=Math.abs(L.requested-L.served-L.unserved);
              const acErr=L.invRun?Math.abs(L.invDC-(L.served-L.genAC)-L.invLossW):0;
              maxDemandError=Math.max(maxDemandError,demandErr);
              maxAcError=Math.max(maxAcError,acErr);
              if(S.genFuelLeft>fuel+1e-9)fuelRises++;
              const nums=[L.requested,L.served,L.unserved,L.unfit,L.mOut,
                L.invDC,L.genAC,L.genDC,L.pvAvail,S.soc,S.genFuelLeft];
              if(!nums.every(Number.isFinite)||demandErr>1e-5||acErr>1e-5||
                L.served < -1e-6||L.unserved < -1e-6||
                L.served>L.requested+1e-6||L.unfit>L.unserved+1e-6||
                S.soc < -1e-8||S.soc>1+1e-8||S.genFuelLeft < -1e-8||
                L.mOut>L.harvestable+1e-5||L.mOut>L.maxOut+1e-5||
                Math.abs((S.stats.requested-st.requested)*60-L.requested)>1e-5||
                Math.abs((S.stats.served-st.served)*60-L.served)>1e-5||
                Math.abs((S.stats.unserved-st.unserved)*60-L.unserved)>1e-5||
                (S.bmsTrip&&L.genDC>0.001)||(!x.pv&&L.mOut>0.001))bad++;
            }
            S.quiet=false;
            all.push({scenario:x.id,minutes:1440,violations:bad,maxDemandErrorW:maxDemandError,
              maxAcErrorW:maxAcError,fuelIncreases:fuelRises,
              fuelUsedGal:fuel0-S.genFuelLeft,fuelLeftGal:S.genFuelLeft,
              unservedWh:S.stats.unserved-stats0.unserved,
              unservedMinutes:S.stats.blackMin-stats0.blackMin});
          }
          S.pvOpen=false;SIM.setWeather('tmy');return all;
        }""")
        assert len(checks) == 6, checks
        for check in checks:
            assert check["violations"] == 0 and check["fuelIncreases"] == 0, check
            assert check["maxDemandErrorW"] < 1e-5, check
            assert check["maxAcErrorW"] < 1e-5, check
            assert 0 <= check["fuelLeftGal"] <= .9500001, check
        by_id = {x["scenario"]: x for x in checks}
        assert by_id["incompatible-240"]["unservedWh"] > 20000, by_id
        assert by_id["manual-generator"]["fuelUsedGal"] == 0, by_id
        assert 0 < by_id["attended-limited-fuel"]["fuelUsedGal"] <= .95, by_id

        winters = page.evaluate("""()=>new Promise((resolve,reject)=>{
          const S=SIM.S,c=S.cfg;
          SIM.setPlaying(false);SIM.setWeather('tmy');S.pvOpen=false;
          Object.assign(c,{genOn:false,genMode:'manual',genFuel:0,snowRec:true,reserve:0});
          SIM.cfgChanged(true,true);
          SIM.runFailureRates(['food','furnace'],()=>{},(summaries,error)=>
            error?reject(Error(error)):resolve(summaries.map(x=>({
              pattern:x.p,winters:x.n,wintersWithUnservedLoad:x.fails,
              medianHoursWithUnservedLoad:x.medH,
              runs:x.runs.map(r=>({year:r.y,unservedMinutes:r.black,
                unservedWh:r.unserved,generatorGallons:r.genGal,
                faults:r.faults,minimumSoc:r.minSoc}))
            }))));
        })""")
        years = page.evaluate("SIM.HIST_YEARS")
        assert len(years) == 25, years
        for batch in winters:
            assert batch["winters"] == 25 and len(batch["runs"]) == 25, batch
            assert [r["year"] for r in batch["runs"]] == years, batch
            assert batch["wintersWithUnservedLoad"] == sum(r["unservedMinutes"] > 0 for r in batch["runs"]), batch
            for r in batch["runs"]:
                assert 0 <= r["unservedMinutes"] <= 172800, r
                assert r["unservedWh"] >= 0 and r["generatorGallons"] == 0, r
                assert 0 <= r["minimumSoc"] <= 1 and r["faults"] >= 0, r
        assert not errors, errors
        report = {
            "interpretation": "Historical model stress tests only, not future blackout probabilities or installation certification",
            "assumptions": ["NASA POWER coarse historical winter inputs",
                "120-day winter, full battery at start",
                "Current default equipment and food/furnace preset loads",
                "Generator disabled", "Equipment and demand assumptions not field-validated"],
            "model_provenance": page.evaluate("window.SIM_PROVENANCE"),
            "invariant_scenarios": checks, "winter_stress_tests": winters
        }
        OUTPUT.write_text(json.dumps(report, indent=2, allow_nan=False)+"\n",encoding="utf-8")
        print("PASS: 6 daily invariant scenarios and 25 historical winters x 2 load patterns")
        for batch in winters:
            print(f"  {batch['pattern']}: {batch['wintersWithUnservedLoad']}/25 histories with unmet load; median {batch['medianHoursWithUnservedLoad']:.1f} hours")
        browser.close()

if __name__ == "__main__":
    main()
