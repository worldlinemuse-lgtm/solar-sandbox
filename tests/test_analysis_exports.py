"""Exported analysis reports must carry exact model, weather and appliance provenance.

This checks the real self-contained page, not a mocked JSON serialization function.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def main():
    with sync_playwright() as pw:
        opts = {"headless": True}
        if os.environ.get("CHROMIUM_BIN"):
            opts["executable_path"] = os.environ["CHROMIUM_BIN"]
        browser = pw.chromium.launch(**opts)
        page = browser.new_page(accept_downloads=True)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.set_content((ROOT / "index.html").read_text(encoding="utf-8"), timeout=60000)
        assert page.locator("#rExport").is_disabled()
        assert page.locator("#ageExport").is_disabled()

        expected = page.evaluate("""()=>{
          const design=SIM.buildPayload();
          const patterns={mine:JSON.parse(JSON.stringify(SIM.S.loads))};
          const report=SIM.makeAnalysisRecord('historical_winter_stress',design,patterns,
            [{p:'mine',n:25,fails:4,runs:[{y:2023,black:40,unserved:1500}]}]);
          // Editing the live object after the record was constructed must not mutate its inputs.
          const oldShade=report.design.cfg.shade;
          const oldWatts=report.appliance_patterns.mine[0].w;
          SIM.S.cfg.shade=17;SIM.S.loads[0].w+=55;
          const preserved=oldShade===report.design.cfg.shade
            &&oldWatts===report.appliance_patterns.mine[0].w;
          SIM.S.cfg.shade=oldShade;SIM.S.loads[0].w=oldWatts;
          return {report,preserved};
        }""")
        assert expected["preserved"], expected
        assert expected["report"]["model_provenance"]["revision_sha256"]
        assert expected["report"]["weather"]["historical_winters"] == page.evaluate("SIM.HIST_YEARS")
        assert expected["report"]["appliance_patterns"]["mine"]
        assert expected["report"]["design"]["cfg"]

        with page.expect_download(timeout=30000) as d:
            page.evaluate("""()=>{
              const p=SIM.makeAnalysisRecord('historical_winter_stress',SIM.buildPayload(),
                   {mine:SIM.S.loads},[{p:'mine',n:25,fails:4,runs:[]}]);
              return SIM.downloadAnalysis(p,'solar-winter-fixture.json');
            }""")
        dl = d.value
        assert dl.suggested_filename == "solar-winter-fixture.json", dl.suggested_filename
        report = json.loads(Path(dl.path()).read_text(encoding="utf-8"))
        assert report["analysis"] == "historical_winter_stress"
        assert report["model_provenance"] == page.evaluate("window.SIM_PROVENANCE")
        assert report["results"][0]["fails"] == 4
        assert report["calibration"].startswith("Engineering simulation")

        aging = page.evaluate("""()=>{
          const report=SIM.makeAnalysisRecord('battery_aging',SIM.buildPayload(),
             {mine:SIM.S.loads},{pat:'mine',efcYr:150,rows:[{y:1,soh:.98}]});
          return {analysis:report.analysis,scenario:report.results.pat,
             source:report.model_provenance.revision_sha256,
             initial:report.initial_conditions,results:report.results};
        }""")
        assert aging["analysis"] == "battery_aging" and aging["scenario"] == "mine"
        assert aging["source"] == report["model_provenance"]["revision_sha256"]
        assert aging["initial"]["aging_model"] == "estimated capacity-loss heuristic"
        assert len(aging["results"]["rows"]) == 1

        # Designs may be imported across model revisions, with a mismatch warning.
        provenance = page.evaluate("""()=>{
          const old=SIM.buildPayload();
          const same=SIM.modelRevisionWarning(old);
          const missing=JSON.parse(JSON.stringify(old));delete missing.model_provenance;
          const missingWarning=SIM.modelRevisionWarning(missing);
          const mismatch=JSON.parse(JSON.stringify(old));
          mismatch.model_provenance.revision_sha256='0'.repeat(64);
          const warn=SIM.modelRevisionWarning(mismatch);
          const st=SIM.buildStatePayload();
          st.design.model_provenance.revision_sha256='0'.repeat(64);
          const previous=JSON.stringify(SIM.S.cfg);
          const runningRevision=window.SIM_PROVENANCE.revision_sha256;
          const rejection=SIM.applyState(st);
          const independent=window.SIM_PROVENANCE.revision_sha256===runningRevision;
          return {same,missingWarning:!!missingWarning,warn:!!warn,
            rejection,independent,unchanged:JSON.stringify(SIM.S.cfg)===previous};
        }""")
        assert provenance["same"] == "" and provenance["missingWarning"], provenance
        assert provenance["warn"] and provenance["unchanged"] and provenance["independent"], provenance
        assert "another model revision" in provenance["rejection"], provenance

        # A changing system invalidates previously displayed results and keeps exports disabled.
        stale = page.evaluate("""()=>{
          document.querySelector('#rOut').innerHTML='<div>outdated winter</div>';
          document.querySelector('#ageOut').innerHTML='<div>outdated aging</div>';
          SIM.cfgChanged(false);
          return {rateEmpty:!document.querySelector('#rOut').children.length,
             ageEmpty:!document.querySelector('#ageOut').children.length,
             rateDisabled:document.querySelector('#rExport').disabled,
             ageDisabled:document.querySelector('#ageExport').disabled};
        }""")
        assert all(stale.values()), stale
        assert not errors, errors
        browser.close()
        print("PASS: exact configuration and model provenance, exported JSON, immutable inputs, invalidation")


if __name__ == "__main__":
    main()
