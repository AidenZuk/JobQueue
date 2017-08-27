/**
 * Created by zhuqizhong on 16-10-15.
 */
var Q = require('q')


/**
 * 定时执行一个函数
 * @param action
 * @param timeout
 * @returns {*}
 * @constructor
 */

var TimedExec = function(action,timeout){

    var args = Array.prototype.slice.call(arguments).slice(2);
    var defer = Q.defer();
    var timeHandle = setTimeout(function(){
        timeHandle = null;
      //  console.log('timeout now');
        defer.reject('timeout ...');
    },timeout||100);
    Q.denodeify(action).apply(null,args).then(function(result){
        if(timeHandle) {
            clearTimeout(timeHandle);
          //  console.log('resolved:',result);
            defer.resolve(result);
        }
    }).catch(function(e){
        if(timeHandle){
            clearTimeout(timeHandle);
            console.log('rejected:',e);
            defer.reject(e);
        }

    })
    return defer.promise;
}

/**
 * 定时执行，执行类里面的函数
 * @param action
 * @param timeout
 * @param obj
 * @returns {*}
 * @constructor
 */
var TimedExecObj = function(action,timeout,obj){

    var args = Array.prototype.slice.call(arguments).slice(3);
    var defer = Q.defer();
    var timeHandle = setTimeout(function(){
        timeHandle = null;
        //  console.log('timeout now');
        defer.reject('timeout');
    },timeout||100);
    Q.nbind(action,obj).apply(obj,args).then(function(result){
        if(timeHandle) {
            clearTimeout(timeHandle);
            //  console.log('resolved:',result);
            defer.resolve(result);
        }
    }).catch(function(e){
        if(timeHandle){
            clearTimeout(timeHandle);
            //  console.log('rejected:',e);
            defer.reject(e);
        }

    })
    return defer.promise;
}


var TimedThen = function(routine,timeout,target){
    var defer = Q.defer();
    var args = Array.prototype.slice.call(arguments).slice(3);
    var timeHandle = setTimeout(function(){
        timeHandle = null;
        //  console.log('timeout now');
        defer.reject('timeout');
    },timeout||100);
    Q().then(function(){
        return routine.apply(target,args);
    }).then(function(result){
        if(timeHandle) {
            clearTimeout(timeHandle);
            //  console.log('resolved:',result);
            defer.resolve(result);
        }
    }).catch(function(e){
        if(timeHandle){
            clearTimeout(timeHandle);
            //  console.log('rejected:',e);
            defer.reject(e);
        }

    })
    return defer.promise;
}


var TimedEvent = function(evtname,evtTarget,timeout){
    var defer = Q.defer();
    var args = Array.prototype.slice.call(arguments).slice(3);
    var timeHandle = setTimeout(function(){
        timeHandle = null;
        //  console.log('timeout now');
        evtTarget.removeAllListeners(evtname);
        defer.reject('timeout');
    },timeout||100);
    
    evtTarget.once(evtname,function(data){
        if(timeHandle){
            clearTimeout(timeHandle);
            timeHandle = null;
            evtTarget.removeAllListeners(evtname);
            defer.resolve(data);
        }
        
    })
    return defer.promise;
}

module.exports.TimedExec = TimedExec;
module.exports.TimedExecObj = TimedExecObj;
module.exports.TimedThen = TimedThen;
module.exports.TimedEvent = TimedEvent;


