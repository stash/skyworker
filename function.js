// onmessage = function(workUnit) {
// postMessage(function(data) {
//     /* YOUR CODE GOES HERE */
//   }(workUnit.data))
// };

var start = new Date().getTime();
var x = data;
for (var i=0; i<100000000; i++) {
  x = (x * x) % 67108864;
}
var end = new Date().getTime();

return {num:x, data: data, time: end-start};
