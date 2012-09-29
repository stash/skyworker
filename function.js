// onmessage = function(workUnit) {
// postMessage(function(data) {
//     /* YOUR CODE GOES HERE */
//   }(workUnit.data))
// };

var start = new Date().getTime();
for (var i=0; i<10000000; i++) {
  data *= data;
}
var end = new Date().getTime();

return {num:data, time: end-start};
