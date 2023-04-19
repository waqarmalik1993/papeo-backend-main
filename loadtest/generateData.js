/*
Latitude: -85 to +85 (actually -85.05115 for some reason)

Longitude: -180 to +180
*/

function padLeadingZeros(num, size) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

const count = 250000;
//console.log("phone,username,lat,long");
for (let i = 0; i < count; i++) {
  console.log(`"49${padLeadingZeros(i, 11)}","user${i}",${(i%170)-85},${(i%360)-180}`);
}
