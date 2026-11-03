"""The new physical core is embedded into the existing offline page in read-only mode.
Every underlying config and simulated state must remain unchanged by diagnostics.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent

def main():
    with sync_playwright() as p:
        opts={"headless":True}
        if os.getenv("CHROMIUM_BIN"):
            opts["executable_path"]=os.environ["CHROMIUM_BIN"]
        browser=p.chromium.launch(**opts)
        page=browser.new_page()
        errors=[]
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.set_content((ROOT/"index.html").read_text(encoding="utf-8"),timeout=60000)
        x=page.evaluate("""()=>{
          const a=window.SolarNextCore,src=SIM.S;
          const first=JSON.stringify({cfg:src.cfg,loads:src.loads,soc:src.soc,
            generatorFuel:src.genFuelLeft,weather:SIM.wxId()});
          const status=a.validationStatus;
          const g=a.shadowPv({panelId:'lg435',controllerId:'150/70',
            irradianceWm2:1000,cellTemperatureC:25,series:2,
            stringsByController:[2],mpptCurrentLimitA:70,
            mpptAbsoluteVocV:150,mpptOperatingVocV:145,mpptIscLimitA:50,
            mpptEfficiency:.98,pvCableLoopOhm:.1,controllerCableLoopOhm:.03,
            busVoltageV:26.4,legacyControllerOutputW:null,legacySnowFraction:0});
          const unsupported=a.shadowPv({panelId:'r200',controllerId:'150/70',
            irradianceWm2:1000,cellTemperatureC:25,series:2,
            stringsByController:[2],mpptCurrentLimitA:70,
            mpptAbsoluteVocV:150,mpptOperatingVocV:145,mpptIscLimitA:50,
            mpptEfficiency:.98,pvCableLoopOhm:.1,controllerCableLoopOhm:.03,
            busVoltageV:26.4,legacyControllerOutputW:null,legacySnowFraction:0});
          const definitions=a.getMathematicalDefinitions();
          const wire=a.evaluateMathematics('wire',{
            'wire.currentA':10,'wire.loopOhm':.1,'interval.seconds':60
          });
          // The consumer may edit its descriptive COPY, not the canonical law.
          definitions.wire.equations[0].revision=999;
          const again=a.getMathematicalDefinitions();
          const legacy=SIM.nextCoreShadow();
          return {status,bundle:typeof a.runReferenceIsland,
            mathModels:Object.keys(definitions).length,
            mathRevisionUnaffected:again.wire.equations[0].revision!==999,
            wireLossW:wire.values['wire.heatW'],
            wireHeatWh:wire.values['wire.heatWh'],
            wireConservation:wire.invariants.every(v=>v.passed),
            topologyApi:typeof a.inspectInstallation,
            g,unsupported:unsupported.status,legacy:legacy.status,
            unchanged:first===JSON.stringify({cfg:src.cfg,loads:src.loads,soc:src.soc,
              generatorFuel:src.genFuelLeft,weather:SIM.wxId()}),
            modelHash:window.SIM_PROVENANCE.source_sha256['next-core-browser.js']};
        }""")
        assert x["bundle"]=="function" and x["unchanged"],x
        assert x["status"]["canReplaceProductionSolver"] is False
        assert x["status"]["physicalCalibration"] is False
        assert x["mathModels"] >= 5 and x["mathRevisionUnaffected"],x
        assert abs(x["wireLossW"] - 10)<1e-9,x
        assert abs(x["wireHeatWh"] - 10/60)<1e-9,x
        assert x["wireConservation"] and x["topologyApi"]=="function",x
        assert x["g"]["status"]=="estimated",x
        assert 0 < x["g"]["controllerMaximumEnvelopeW"] < 1750,x
        assert x["unsupported"]=="unsupported"
        assert x["legacy"] in ("unsupported","indeterminate","estimated")
        assert len(x["modelHash"])==64
        assert not errors,errors
        browser.close()
        print("PASS: read-only offline integration, provenance, selected hardware boundaries and no mutation")
if __name__=="__main__":main()
