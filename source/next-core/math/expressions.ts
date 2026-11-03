/**
 * Authoritative, serializable, typed mathematical expressions.
 *
 * Mathematical units are not mere decoration. In particular W, VA and var
 * are SEMANTICALLY DISTINCT despite having identical SI base dimensions.
 * Only dcPower(), realFromVA() and apparentFromReal() authorize conversion.
 * Runtime evaluation is an interpreter of the declaration, not a second formula.
 */
import {ModelFailure,finite} from "../contracts";

export type Unit =
  "1" | "V" | "A" | "ohm" | "A2" | "W" | "VA" | "var" |
  "Wh" | "Ah" | "s" | "gal" | "gal/h";
export type Expr =
 | {readonly op:"ref";readonly name:string}
 | {readonly op:"literal";readonly unit:Unit;readonly value:number}
 | {readonly op:"add"|"subtract"|"multiply"|"divide"|"minimum"|"maximum";readonly a:Expr;readonly b:Expr}
 | {readonly op:"negate"|"absolute"|"square";readonly x:Expr}
 | {readonly op:"dcPower";readonly voltage:Expr;readonly current:Expr}
 | {readonly op:"ohmicLoss";readonly current:Expr;readonly resistance:Expr}
 | {readonly op:"energyWh";readonly power:Expr;readonly seconds:Expr}
 | {readonly op:"chargeAh";readonly current:Expr;readonly seconds:Expr}
 | {readonly op:"realFromVA";readonly apparent:Expr;readonly pf:Expr}
 | {readonly op:"apparentFromReal";readonly real:Expr;readonly pf:Expr};

export const M = {
 ref:(name:string):Expr=>({op:"ref",name}),
 c:(value:number,unit:Unit="1"):Expr=>({op:"literal",value,unit}),
 add:(a:Expr,b:Expr):Expr=>({op:"add",a,b}),
 sub:(a:Expr,b:Expr):Expr=>({op:"subtract",a,b}),
 mul:(a:Expr,b:Expr):Expr=>({op:"multiply",a,b}),
 div:(a:Expr,b:Expr):Expr=>({op:"divide",a,b}),
 min:(a:Expr,b:Expr):Expr=>({op:"minimum",a,b}),
 max:(a:Expr,b:Expr):Expr=>({op:"maximum",a,b}),
 neg:(x:Expr):Expr=>({op:"negate",x}),
 abs:(x:Expr):Expr=>({op:"absolute",x}),
 sq:(x:Expr):Expr=>({op:"square",x}),
 dc:(voltage:Expr,current:Expr):Expr=>({op:"dcPower",voltage,current}),
 i2r:(current:Expr,resistance:Expr):Expr=>({op:"ohmicLoss",current,resistance}),
 wh:(power:Expr,seconds:Expr):Expr=>({op:"energyWh",power,seconds}),
 ah:(current:Expr,seconds:Expr):Expr=>({op:"chargeAh",current,seconds}),
 acW:(apparent:Expr,pf:Expr):Expr=>({op:"realFromVA",apparent,pf}),
 acVA:(real:Expr,pf:Expr):Expr=>({op:"apparentFromReal",real,pf})
};
type SymbolUnits=Readonly<Record<string,Unit>>;
type SymbolValues=Readonly<Record<string,number>>;

function invalid(message:string):never{
 throw new ModelFailure("INVALID_INPUT","Mathematical expression: "+message);
}
function arithmeticUnit(op:Expr["op"],a:Unit,b:Unit):Unit{
 if(op==="add"||op==="subtract"||op==="minimum"||op==="maximum"){
   if(a!==b)invalid(op+" cannot combine "+a+" and "+b);
   return a;
 }
 if(op==="multiply"){
   if(a==="1")return b;
   if(b==="1")return a;
   if(a==="A"&&b==="ohm"||a==="ohm"&&b==="A")return "V";
   // DC power must be created through dcPower() to document its jurisdiction.
   invalid("unsupported multiplication "+a+" * "+b+"; use a scoped physical operator");
 }
 if(op==="divide"){
   if(b==="1")return a;
   if(a===b)return "1";
   if(a==="V"&&b==="A")return "ohm";
   if(a==="V"&&b==="ohm")return "A";
   if(a==="W"&&b==="V")return "A";
   if(a==="Wh"&&b==="W")return "s"; // ONLY WITH an explicit 3600 conversion; reject below.
   invalid("unsupported division "+a+" / "+b+"; specify the conversion explicitly");
 }
 return invalid("unknown arithmetic operator "+op);
}
export function references(expr:Expr):readonly string[]{
 const names=new Set<string>();
 const visit=(e:Expr):void=>{
  if(e.op==="ref"){names.add(e.name);return;}
  if(e.op==="literal")return;
  if("a" in e){visit(e.a);visit(e.b);return;}
  if("x" in e){visit(e.x);return;}
  if(e.op==="dcPower"){visit(e.voltage);visit(e.current);return;}
  if(e.op==="ohmicLoss"){visit(e.current);visit(e.resistance);return;}
  if(e.op==="energyWh"){visit(e.power);visit(e.seconds);return;}
  if(e.op==="chargeAh"){visit(e.current);visit(e.seconds);return;}
  if(e.op==="realFromVA"){visit(e.apparent);visit(e.pf);return;}
  if(e.op==="apparentFromReal"){visit(e.real);visit(e.pf);return;}
 };
 visit(expr);return [...names].sort();
}
export function unitOf(expr:Expr,units:SymbolUnits):Unit{
 switch(expr.op){
  case "ref":{
    if(!Object.prototype.hasOwnProperty.call(units,expr.name))
      invalid("undeclared symbol "+expr.name);
    return units[expr.name];
  }
  case "literal":finite("literal",expr.value);return expr.unit;
  case "add":case "subtract":case "multiply":case "divide":
  case "minimum":case "maximum":{
    const a=unitOf(expr.a,units),b=unitOf(expr.b,units);
    if(expr.op==="divide"&&a==="Wh"&&b==="W")
      invalid("Wh/W requires a factor of 3600 seconds; use explicit energy conversion");
    return arithmeticUnit(expr.op,a,b);
  }
  case "negate":case "absolute":return unitOf(expr.x,units);
  case "square":{
    const u=unitOf(expr.x,units);
    if(u==="A")return "A2";
    if(u==="1")return "1";
    invalid("unsupported square of "+u);
  }
  case "dcPower":
    if(unitOf(expr.voltage,units)!=="V"||unitOf(expr.current,units)!=="A")
      invalid("dcPower requires V and signed A");
    return "W";
  case "ohmicLoss":
    if(unitOf(expr.current,units)!=="A"||unitOf(expr.resistance,units)!=="ohm")
      invalid("ohmicLoss requires A and ohm");
    return "W";
  case "energyWh":
    if(unitOf(expr.power,units)!=="W"||unitOf(expr.seconds,units)!=="s")
      invalid("energyWh requires W and seconds");
    return "Wh";
  case "chargeAh":
    if(unitOf(expr.current,units)!=="A"||unitOf(expr.seconds,units)!=="s")
      invalid("chargeAh requires signed A and seconds");
    return "Ah";
  case "realFromVA":
    if(unitOf(expr.apparent,units)!=="VA"||unitOf(expr.pf,units)!=="1")
      invalid("realFromVA requires VA and dimensionless PF");
    return "W";
  case "apparentFromReal":
    if(unitOf(expr.real,units)!=="W"||unitOf(expr.pf,units)!=="1")
      invalid("apparentFromReal requires W and dimensionless PF");
    return "VA";
 }
}
export function evaluate(expr:Expr,values:SymbolValues):number{
 const val=(e:Expr):number=>evaluate(e,values);
 let out:number;
 switch(expr.op){
  case "ref":
   if(!Object.prototype.hasOwnProperty.call(values,expr.name))
     invalid("missing symbol "+expr.name);
   return finite(expr.name,values[expr.name]);
  case "literal":return finite("constant",expr.value);
  case "add":out=val(expr.a)+val(expr.b);break;
  case "subtract":out=val(expr.a)-val(expr.b);break;
  case "multiply":out=val(expr.a)*val(expr.b);break;
  case "divide":{
    const denom=val(expr.b);
    if(denom===0)invalid("division by zero");
    out=val(expr.a)/denom;break;
  }
  case "minimum":out=Math.min(val(expr.a),val(expr.b));break;
  case "maximum":out=Math.max(val(expr.a),val(expr.b));break;
  case "negate":out=-val(expr.x);break;
  case "absolute":out=Math.abs(val(expr.x));break;
  case "square":out=val(expr.x)**2;break;
  case "dcPower":out=val(expr.voltage)*val(expr.current);break;
  case "ohmicLoss":out=val(expr.current)**2*val(expr.resistance);break;
  case "energyWh":out=val(expr.power)*val(expr.seconds)/3600;break;
  case "chargeAh":out=val(expr.current)*val(expr.seconds)/3600;break;
  case "realFromVA":{
    const pf=val(expr.pf);
    if(pf<0||pf>1)invalid("realFromVA requires 0 <= PF <= 1");
    out=val(expr.apparent)*pf;break;
  }
  case "apparentFromReal":{
    const pf=val(expr.pf);
    if(pf<=0||pf>1)invalid("apparentFromReal requires 0 < PF <= 1");
    out=val(expr.real)/pf;break;
  }
 }
 return finite("expression result",out);
}
