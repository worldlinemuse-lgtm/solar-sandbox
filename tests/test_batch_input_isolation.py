"""Regression: historical stress and aging reports must reject stale appliance data.

Run after generating index.html: python tests/test_batch_input_isolation.py
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def main():
    with sync_playwright() as pw:
        args = {"headless": True}
        if os.getenv("CHROMIUM_BIN"):
            args["executable_path"] = os.environ["CHROMIUM_BIN"]
        browser = pw.chromium.launch(**args)
        page = browser.new_page()
        page.set_default_timeout(120000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.set_content((ROOT / "index.html").read_text(encoding="utf-8"), timeout=60000)

        # A mutation between two 60,000-minute chunks MUST discard all results.
        rate = page.evaluate("""()=>new Promise(resolve=>{
          const S=SIM.S;SIM.setPlaying(false);const old=S.loads[0].w;
          let changed=false,otherBlocked=null,ageBlocked=null;
          SIM.runFailureRates(['mine'],message=>{
            if(message.startsWith('Winter ')&&!changed){
              S.loads[0].w=old+37;changed=true;
            }
          },(results,reason)=>{
            S.loads[0].w=old;
            resolve({changed,reason,results:results.length,otherBlocked,ageBlocked});
          });
          SIM.runFailureRates(['mine'],()=>{},(results,reason)=>{otherBlocked=reason;});
          SIM.runAging('mine',()=>{},(result,reason)=>{ageBlocked=reason;});
        })""")
        assert rate["changed"] and rate["results"] == 0, rate
        assert "appliance" in (rate["reason"] or "").lower(), rate
        assert "already running" in (rate["otherBlocked"] or "").lower(), rate
        assert "already running" in (rate["ageBlocked"] or "").lower(), rate

        aging = page.evaluate("""()=>new Promise(resolve=>{
          const S=SIM.S,old=S.loads[0].w;let changed=false;
          SIM.runAging('mine',message=>{
            if(message.startsWith('Measuring ')&&!changed){S.loads[0].w=old+53;changed=true;}
          },(out,reason)=>{
            S.loads[0].w=old;
            resolve({changed,reason,hasOutput:!!out});
          });
        })""")
        assert aging["changed"] and not aging["hasOutput"], aging
        assert "appliance" in (aging["reason"] or "").lower(), aging

        worst = page.evaluate("""()=>new Promise(resolve=>{
          const S=SIM.S,oldTilt=S.cfg.tilt;
          let changed=false;
          SIM.findWorstStretch(7,(i,total)=>{
            if(i===1&&!changed){S.cfg.tilt=oldTilt+1;changed=true;}
          },(result,reason)=>{
            S.cfg.tilt=oldTilt;
            resolve({changed,hasResult:!!result,reason});
          });
        })""")
        assert worst["changed"] and not worst["hasResult"], worst
        assert "changed" in (worst["reason"] or "").lower(), worst

        stale = page.evaluate("""()=>{
          document.getElementById('rOut').innerHTML='<div>old historical outcome</div>';
          document.getElementById('ageOut').innerHTML='<div>old aging outcome</div>';
          SIM.cfgChanged(false);
          return {
            rateEmpty:!document.getElementById('rOut').children.length,
            ageEmpty:!document.getElementById('ageOut').children.length,
            rateNote:document.getElementById('rProg').textContent,
            ageNote:document.getElementById('ageProg').textContent
          };
        }""")
        assert stale["rateEmpty"] and stale["ageEmpty"], stale
        assert "Inputs changed" in stale["rateNote"] and "Inputs changed" in stale["ageNote"], stale
        assert not errors, errors
        browser.close()
        print("PASS: stale historical and aging runs cancelled; concurrent runs rejected; old results cleared")


if __name__ == "__main__":
    main()
