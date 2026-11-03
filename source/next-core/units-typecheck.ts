import {watts,voltAmps,seconds,integratePower,wattHours,Watts,VoltAmps} from "./units";
// This file intentionally runs only during type checking. It proves the unit tags
// prevent common errors even though all runtime units are JS numbers.
const real:Watts=watts(100);
const apparent:VoltAmps=voltAmps(250);
void integratePower(real,seconds(30));
void wattHours(0);
// @ts-expect-error Apparent power cannot replace real electrical power
integratePower(apparent,seconds(30));
// @ts-expect-error An energy value cannot replace a real-power value
const wrong:Watts=wattHours(15);
void wrong;
