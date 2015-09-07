export function spread(attribute) {
  var list = [];
  var keys = Object.keys(attribute);
  for (var i = 0, n = keys.length; i < n; i++) {
    var key = keys[i];
    list.push(key + '="' + attribute[key] + '"');
  }
  return list;
}
