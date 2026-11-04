"""Published-parameter PVsyst shunt: independent pvlib Lambert W cross-check.

JavaScript fits Rsh0 on published irradiance/Mpp points at 25 C.
Python independently reconstructs the published Sandia Rsh(G) equations and
uses pvlib's Lambert-W diode solution. Held-out 400/800 W/m2 curves are
checked against the original 2020 LONGi/PVsyst PDF. No field test required
to verify mathematics; no physical performance claim is made.
"""
import json, math, subprocess
from pathlib import Path
import pvlib

ROOT=Path(__file__).resolve().parent.parent
SOURCE="https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf"
POINTS={200:85.7,400:174.6,600:263.2,800:350.6,1000:436.1}
NODE=r"""
const {fitPublishedLongiPvsystRshZero}=require('./.next-core-dist/pvsyst-published-fit.js');
const {pvsystShuntResistance}=require('./.next-core-dist/pvsyst-shunt.js');
const {singleDiodeMpp}=require('./.next-core-dist/pv-diode.js');
const fit=fitPublishedLongiPvsystRshZero();
const series=[200,400,600,800,1000].map(g=>({
  irradiance:g,powerW:singleDiodeMpp(fit.calibratedReference,g,25).maxPowerW,
  rshOhm:pvsystShuntResistance({irradianceWm2:g,referenceIrradianceWm2:1000,
    rshReferenceOhm:1000,rshAtZeroIrradianceOhm:fit.fittedRshZeroOhm,decay:5.5})
}));
console.log(JSON.stringify({r0:fit.fittedRshZeroOhm,train:fit.trainingRelativeRmse,
 holdout:fit.heldOutRelativeRmse,powers:series}));
"""
js=json.loads(subprocess.run(["node","-e",NODE],cwd=ROOT,check=True,
    text=True,capture_output=True).stdout)

# PVsyst parameterization at reference T=25C. The functional form of Rsh(G)
# comes from Sandia PVPMC, while the equipment STC values come from its PDF.
Isc=11.36
Rs=0.27
Rref=1000.
I0=0.087e-9
n=1.04
nser=72
Tref=298.15
alpha=n*nser*1.380649e-23*Tref/1.602176634e-19
ILref=Isc+I0*math.expm1(Isc*Rs/alpha)+Isc*Rs/Rref
r0=js["r0"]
assert 1000<r0<200000,(SOURCE,r0)
exp_ref=math.exp(-5.5)
base=(Rref-r0*exp_ref)/(1-exp_ref)
assert base>0
for row in js["powers"]:
    g=row["irradiance"]
    rsh=base+(r0-base)*math.exp(-5.5*g/1000)
    assert abs(row["rshOhm"]-rsh)<1e-8*max(1,rsh)
    diode=pvlib.pvsystem.singlediode(
        photocurrent=ILref*g/1000,saturation_current=I0,
        resistance_series=Rs,resistance_shunt=rsh,
        nNsVth=alpha,method="lambertw"
    )
    reference=float(diode["p_mp"])
    assert abs(row["powerW"]-reference)/reference<0.0005,(g,row,reference)
    # Published fixture validation, a different assertion from numerical agreement.
    assert abs(row["powerW"]-POINTS[g])/POINTS[g]<0.002,(g,row,POINTS[g])
assert js["train"]<0.001,js
assert js["holdout"]<0.002,js
print("PASS: published 2020 LONGi/PVsyst Rsh(G) inverse fit, held-out curves and independent pvlib Lambert W; not field data")
