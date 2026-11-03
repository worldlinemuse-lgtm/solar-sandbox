"""Independent manufacturer/NEC-table reference fixtures and deterministic source provenance.

These fixtures test published numerical limits and circuit algebra, not measured household
hardware performance. Fails closed if a published field or source digest drifts.
"""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "validation" / "reference_fixtures.json").read_text(encoding="utf-8"))


def near(actual, expected, name, tolerance=1e-9):
    assert isinstance(actual, (float, int)) and abs(actual-expected) <= tolerance, (
        name, actual, expected)


def main():
    assert DATA["schema"] == 1
    with sync_playwright() as pw:
        launch = {"headless": True}
        if os.getenv("CHROMIUM_BIN"):
            launch["executable_path"] = os.environ["CHROMIUM_BIN"]
        browser = pw.chromium.launch(**launch)
        page = browser.new_page()
        page.set_content((ROOT / "index.html").read_text(encoding="utf-8"), timeout=60000)
        assert page.evaluate("typeof SIM") == "object"

        manifest = page.evaluate("window.SIM_PROVENANCE")
        assert manifest["schema"] == 1 and len(manifest["revision_sha256"]) == 64
        files = manifest["source_sha256"]
        core = ROOT / "source" / "next-core"
        expected_core = {"next-core/" + path.relative_to(core).as_posix()
                         for path in core.rglob("*.ts")}
        assert set(files) == ({
            "build.py", "template.html", "sim.js", "physics.js", "elec.js", "battery.js",
            "tmy.js", "hist.js", "snowhist.js", "guide.mp3", "next-core-browser.js"
        } | expected_core)
        assert all("next-core/" + filename in files for filename in [
            "entry.ts", "pv-diode.ts", "island.ts", "battery.ts", "generator.ts", "ac.ts"
        ])
        for filename, digest in files.items():
            actual = hashlib.sha256((ROOT / "source" / filename).read_bytes()).hexdigest()
            assert digest == actual, ("source drift", filename, digest, actual)
        canonical = json.dumps(files, sort_keys=True, separators=(",", ":")).encode()
        near(len(manifest["revision_sha256"]), 64, "digest length")
        assert manifest["revision_sha256"] == hashlib.sha256(canonical).hexdigest()
        # Import/export preserves the model provenance of a design.
        saved = page.evaluate("SIM.buildPayload()")
        assert saved["model_provenance"] == manifest

        got = page.evaluate("""()=>{
          const m=SIM.MPPTS.find(x=>x.id==='150/70'),P=SIM.PHYS,E=SIM.ELEC;
          const a=SIM.MPPTS.find(x=>x.id==='150/35');
          return {
            controller:{
              max_charge_a:m.amps,max_voc_v:m.abs,max_operating_voc_v:m.op,
              max_pv_isc_a:m.isc,pv_nominal_w:m.pv,peak_efficiency:m.eff
            },
            ampacity:[
              E.baseAmp('cu','10',75),E.baseAmp('cu','6',75),
              E.baseAmp('cu','12',60),E.baseAmp('al','4',75)
            ],
            cable:{
              resistance:P.loopR('cu','10',50,75),
              voltage_drop:10*P.loopR('cu','10',50,75),
              ohmic_loss:100*P.loopR('cu','10',50,75)
            },
            examples:[
              E.ampacityCheck({mat:'cu',gauge:'10',ambC:30,ccc:3,ins:75,term:75},
                             {imax:25,cont125:true}),
              E.ampacityCheck({mat:'cu',gauge:'10',ambC:30,ccc:3,ins:75,term:75},
                             {imax:30,cont125:true})
            ],
            conflict_catalog_value:a.isc
          };
        }""")
        m = DATA["controller"]
        for key in ["max_charge_a", "max_voc_v", "max_operating_voc_v",
                    "max_pv_isc_a", "peak_efficiency"]:
            near(got["controller"][key], m[key], key)
        for volt, watts in m["pv_nominal_w"].items():
            near(got["controller"]["pv_nominal_w"][volt], watts, "PV nominal power "+volt)
        for datum, actual in zip(DATA["ampacity"], got["ampacity"]):
            near(actual, datum["expected_a"], datum["id"])
        for key, expected in [
            ("resistance", DATA["circuit"]["expected_round_trip_ohms"]),
            ("voltage_drop", DATA["circuit"]["expected_voltage_drop_v"]),
            ("ohmic_loss", DATA["circuit"]["expected_resistive_loss_w"])
        ]:
            near(got["cable"][key], expected, key)
        assert got["examples"][0]["status"] == "tbl", got["examples"]
        assert got["examples"][1]["status"] == "fail", got["examples"]

        ambiguous = page.evaluate("""()=>{
          SIM.setPanelType('r400');
          const c=SIM.S.cfg;c.ser=1;c.par=3;c.nMppt=1;c.mppt='150/35';
          const result=SIM.checks().find(x=>x[1].startsWith('Panel short-circuit current per controller:'));
          return {result,isc:3*SIM.PANEL.isc};
        }""")
        assert 35 < ambiguous["isc"] < 40, ambiguous
        assert ambiguous["result"][0] == DATA["controller_discrepancy"]["require_status_above_manual"], ambiguous
        assert "35 A" in ambiguous["result"][1] and "40 A" in ambiguous["result"][1], ambiguous
        browser.close()
        print("PASS: manufacturer MPPT fixture, NEC ampacity tables, circuit equations,")
        print("      explicit unresolved 150/35 specification conflict, source provenance digests")


if __name__ == "__main__":
    main()
