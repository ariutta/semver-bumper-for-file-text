require('pretty-error').start();
var VError = require('verror');

var RxNode = require('rx-node-extra');
var Rx = RxNode.Rx;
var RxFs = require('rx-fs');

function update(filepath, updater) {

  var dataSource = RxFs.createReadObservable(filepath, {
      flags: 'r'
    })
    .flatMap(function(data) {
      var lines = data.toString().split('\n');
      // NOTE On OS/X, the last line will be empty, but we
      // still want to keep it.
      // TODO check whether this is cross-platform compatible.
      return Rx.Observable.from(lines);
    });

  var tempPath = filepath + '.temp-file-bump-version';

  var inputSource = dataSource
    .let(updater)
    .doOnError(function(err) {
      var newError = new VError(err, 'Error with provided updater for fileLineUpdater.update');
      console.error(newError.stack);
    });

  return RxFs.stat(filepath)
    .concatMap(function(stat) {
      // TODO Which is better: Option A or B?

      /* Option A
      var destStream = RxFs.createWriteStream(tempPath, {mode: stat.mode})
        .doOnError(function(err) {
          var newError = new VError(err, 'Error writing to file in fileLineUpdater.update');
          console.error(newError.stack);
        });
      return Rx.Observable.fromEvent(inputSource.pipe(destStream), 'finish').first()
      //*/

      //* Option B
      var destSource = RxFs.createWriteObservable(tempPath, {mode: stat.mode});
      return inputSource
        .let(destSource)
        .doOnError(function(err) {
          var newError = new VError(err, 'Error writing to file in fileLineUpdater.update');
          console.error(newError.stack);
        });
    })
    .doOnCompleted(function() {
      RxFs.rename(tempPath, filepath)
        .doOnError(function(err) {
          var newError = new VError(err, 'Err removing tmp file in fileLineUpdater.update');
          console.error(newError.stack);
        });
    });
}

module.exports = {
  update: update
};
