const fs = require('fs');
const S = JSON.parse(fs.readFileSync(__dirname + '/script.json', 'utf8'));
const D = JSON.parse(fs.readFileSync(__dirname + '/vo/durations.json', 'utf8'));
const LEAD = 0.5;
module.exports = function plan(video) {
  let start = 0;
  return S[video].map((sc) => {
    const v = Math.max(D[`${video}/${sc.id}/en`], D[`${video}/${sc.id}/hi`]);
    let dur = Math.max(4.5, v + LEAD + 0.8);
    if (sc.id === 'cta') dur += 2.5;
    const p = { id: sc.id, start: +start.toFixed(3), dur: +dur.toFixed(3), vo: +(start + LEAD).toFixed(3) };
    start += dur;
    return p;
  });
};
