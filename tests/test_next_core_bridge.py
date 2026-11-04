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
          const designTest=a.assessPvColdDesign({
            vocStcV:49.1,iscStcA:11.36,
            vocTemperatureCoefficientPerC:-.00284,iscTemperatureCoefficientPerC:.0005
          },{modulesInSeries:3,stringsInParallel:2},{
            minimumDesignCellTemperatureC:-29.5,maximumDesignCellTemperatureC:45,
            maximumDesignEffectiveIrradianceWm2:1000
          },{absoluteMaximumInputVoltageV:150,
            startupOperatingMaximumInputVoltageV:145,
            maximumPvShortCircuitCurrentA:50});
          const curve=a.makeInverterDcCurve([
            {acRealOutputW:0,dcInputW:12},{acRealOutputW:500,dcInputW:565}
          ]);
          const calibratedDc=a.interpolateInverterDcInput(curve,250);
          const fuelCurve=a.makeGeneratorFuelCurve([
            {deliveredAcRealW:0,measuredGallonsPerHour:.08},
            {deliveredAcRealW:1800,measuredGallonsPerHour:.30}
          ]);
          const fuelPrediction=a.interpolateGeneratorFuelRate(fuelCurve,900);
          const residuals=a.calibrationResiduals([{observed:8,predicted:9},
            {observed:10,predicted:9}]);
          const copper=a.conductorTemperatureLoss({
            loopResistanceAtReferenceOhm:.1,referenceTemperatureC:20,
            conductorTemperatureC:50,temperatureCoefficientAtReferencePerC:.00393,
            currentA:20,intervalSeconds:3600});
          const reactive=a.assessSignedAcPhasors([
            {id:"lag",realPowerW:600,reactiveVarSigned:800,leg:"L1"},
            {id:"lead",realPowerW:600,reactiveVarSigned:-800,leg:"L1"}
          ],{phases:"120V",continuousRealWPerLeg:2400,
            continuousApparentVAPerLeg:3000,sinusoidalWaveformsConfirmed:true});
          const mppt=a.assessVictron15070Point({
            termination:"MC4_TWO_PAIRS",mode:"starting",batteryBusVoltageV:26.4,
            pvInputPortVoltageV:31.4,maximumColdDesignVocV:112,
            maximumDesignIscA:25,mc4PairDesignIscA:[12,13]});
          const hotInverter=a.assessInverterThermalCapacity(
            a.VICTRON_3KVA_120V_THERMAL,65,2000,2500);
          const ecm=a.advanceBatteryEcm({
            capacityAh:100,ohmicResistanceOhm:.02,
            coulombicChargingEfficiency:.98,
            ocvCurve:[{soc:0,openCircuitVoltageV:24},
              {soc:1,openCircuitVoltageV:28}],
            polarizationPairs:[{resistanceOhm:.01,capacitanceF:1000}]
          },{soc:.5,polarizationVoltagesV:[0]},10,30);
          const shuntFit=a.fitPublishedLongiPvsystRshZero();
          const mpptBound=a.boundMpptDcPower({
            availableControllerInputPowerW:2500,batteryChargeVoltageV:28.8,
            ratedMaximumBatteryChargeCurrentA:70,
            publishedPeakConversionEfficiency:.98,nominalArrayReferenceW:2000
          });
          const hondaQuarter=a.estimateHondaFuelGph(450);
          const hondaIdle=a.estimateHondaFuelGph(0);
          const shuntAtRef=a.pvsystShuntResistance({
            irradianceWm2:1000,referenceIrradianceWm2:1000,
            rshReferenceOhm:1000,rshAtZeroIrradianceOhm:4000,decay:5.5
          });
          const definitions=a.getMathematicalDefinitions();
          const wire=a.evaluateMathematics('wire',{
            'wire.currentA':10,'wire.conductorOhm':.1,'interval.seconds':60
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
            coldDesignStatus:designTest.status,
            calibratedDcW:calibratedDc.predictedDcInputW,
            fuelInterpolationGph:fuelPrediction.gallonsPerHour,
            calibrationRmse:residuals.rmse,
            nonlinearPvSolver:typeof a.solveDiodeArrayCableMpp,
            temperatureSlopeMath:typeof a.fitPublishedPvThermalSlope,
            copperPowerLossW:copper.powerLossW,
            signedReactiveStatus:reactive.status,
            signedReactiveApparentVA:reactive.legs[0].fundamentalApparentVA,
            mc4Status:mppt.status,
            hotInverterStatus:hotInverter.status,
            publishedFitHeldoutRmse:shuntFit.heldOutRelativeRmse,
            publishedFitRsh0:shuntFit.fittedRshZeroOhm,
            mpptBoundW:mpptBound.dcOutputMaximumPossibleW,
            hondaQuarterGph:hondaQuarter.fuelGallonsPerHour,
            hondaIdleUnknown:hondaIdle.status,
            shuntAtRefOhm:shuntAtRef,
            batteryEcmSoc:ecm.endState.soc,
            batteryEcmPolarizationV:ecm.endState.polarizationVoltagesV[0],
            unchanged:first===JSON.stringify({cfg:src.cfg,loads:src.loads,soc:src.soc,
              generatorFuel:src.genFuelLeft,weather:SIM.wxId()}),
            modelHash:window.SIM_PROVENANCE.source_sha256['next-core-browser.js'],
            registryHash:window.SIM_PROVENANCE.source_sha256['next-core/math/models.ts'],
            topologyHash:window.SIM_PROVENANCE.source_sha256['next-core/math/topology.ts']};
        }""")
        assert x["bundle"]=="function" and x["unchanged"],x
        assert x["status"]["canReplaceProductionSolver"] is False
        assert x["status"]["physicalCalibration"] is False
        assert x["mathModels"] >= 5 and x["mathRevisionUnaffected"],x
        assert abs(x["wireLossW"] - 10)<1e-9,x
        assert abs(x["wireHeatWh"] - 10/60)<1e-9,x
        assert x["wireConservation"] and x["topologyApi"]=="function",x
        assert x["g"]["status"]=="estimated",x
        assert x["g"]["designAssessment"]["status"]=="indeterminate",x
        assert x["coldDesignStatus"]=="fail",x
        assert abs(x["calibratedDcW"]-288.5)<1e-9,x
        assert abs(x["fuelInterpolationGph"]-.19)<1e-9,x
        assert abs(x["calibrationRmse"]-1)<1e-9,x
        assert x["nonlinearPvSolver"]=="function",x
        assert x["temperatureSlopeMath"]=="function",x
        assert abs(x["copperPowerLossW"]-44.716)<1e-8,x
        assert x["signedReactiveStatus"]=="pass_sinusoidal_model",x
        assert abs(x["signedReactiveApparentVA"]-1200)<1e-8,x
        assert x["mc4Status"]=="checked_ratings_only",x
        assert x["hotInverterStatus"]=="exceeds_conservative_envelope",x
        assert x["publishedFitHeldoutRmse"]<0.002,x
        assert 15000<x["publishedFitRsh0"]<50000,x
        assert abs(x["mpptBoundW"]-2016)<1e-8,x
        assert abs(x["hondaQuarterGph"]-(.95/8.1))<1e-8,x
        assert x["hondaIdleUnknown"]=="below_published_range",x
        assert abs(x["shuntAtRefOhm"]-1000)<1e-8,x
        assert abs(x["batteryEcmSoc"]-(.5-300/360000))<1e-9,x
        assert abs(x["batteryEcmPolarizationV"]-(.1*(1-__import__("math").exp(-3))))<1e-9,x
        assert 0 < x["g"]["controllerMaximumEnvelopeW"] < 1750,x
        assert x["unsupported"]=="unsupported"
        assert x["legacy"] in ("unsupported","indeterminate","estimated")
        assert len(x["modelHash"])==64
        assert len(x["registryHash"])==64 and len(x["topologyHash"])==64
        assert not errors,errors
        browser.close()
        print("PASS: read-only offline integration, provenance, selected hardware boundaries and no mutation")
if __name__=="__main__":main()
