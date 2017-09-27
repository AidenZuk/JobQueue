/**
 * Created by zhuqizhong on 16-9-8.
 */
const Q = require('q');
const _ = require('lodash');
const Event = require('events');
const util = require('util');
const TimedQ = require('./TimedQ');
const STATE = {
    'IDLE':0,
    'BUSY':1, //正在处理
    'RESEND_WAIT':2, //发送失败,等待重发中
};
/**
 * 只发送一次数据，如果在连续要求发多个数据，而发送回应的时间又比较长，那么就
 * @param options
 *    .threadTimeout 处理一个任务后的延时时间
 *    .consumer      任务函数,要求处理push的target对象,返回一个promise
 * @constructor
 */
function QueueWriteOnce(options) {
    Event.EventEmitter.call(this);
    this.consumer = options.consumer;
    this.state = STATE.IDLE;
    this.targetValue = [];
    let self = this;
    this.run = function () {
        if (this.state === STATE.IDLE) {
            this.targetValue = _.compact(this.targetValue);
            if (this.targetValue && this.targetValue.length > 0) {
                this.state = STATE.BUSY;

                let target = this.targetValue[0];
                let proc_result={success:false,resend:false};
                if (this.consumer) {
                    self.emit('WRITE_START',target);
                    Q().then(function () {
                        console.log('start...');
                        return self.consumer(target);
                      //  return {success:false,reason:"test",resend:true}
                    }).timeout(target.timeout || 1000).then(function(result){
                        console.log('resolved...');
                        self.markFinished(target.value,result);
                        proc_result = result;

                    }.bind(this)).catch(function(e){
                        console.log('error...');
                        proc_result = {success:false,reason:e};
                        self.markFinished(target.value,proc_result);
                        //console.error('!!! error in fin working:',e&& e.message);
                    }).then(function(){
                        self.state = STATE.IDLE;
                        if(self.targetValue.length > 0){
                            console.log('补发最后一个');

                            self.run();
                        }else{
                            self.emit('WRITE_END',proc_result);
                        }
                    });
                }
            }
        }
    }
}
util.inherits(QueueWriteOnce,Event.EventEmitter);
/**
 * 一帧数据完毕后,处理剩余队列中的数据,
 *
 * 根据情况,会有两种
 * 1.如果剩余的最后一个数据与当前写入的一致,就不管了
 * 2.如果最后一个数据与当前数据不一致,保留最后一个数据
 *
 * 所有没有保留的数据,都用这一个次写入的结果作为返回值处理
 *
 * @param curTarget
 * @param result
 */
QueueWriteOnce.prototype.markFinished = function(writeValue, result){
    //过程中已经有一些数据超时了
    this.targetValue = _.compact(this.targetValue);
    if(this.targetValue.length > 0){
        //写入的过程中又来了数据
        let target = (this.targetValue[this.targetValue.length-1]);
        let targetOfFinish = 0;
        if(target.value  === writeValue || _.isEqual(target.value , writeValue)){
            targetOfFinish = this.targetValue.length-1;
        }else{
            targetOfFinish = this.targetValue.length-2;
        }
        for(let i = 0; i <= targetOfFinish;i++){
            let target = this.targetValue[i];
            if(target){ //处理全部没有超时的数据
                if(target.timerHandle){
                    clearTimeout(this.targetValue[i].timerHandle);  //关闭定时器
                }
                if(target.uuid)
                this.emit('resp-'+target.uuid,result);
            }
            this.targetValue[i] = null;
        }

        this.targetValue = _.compact(this.targetValue);

    }
};

/**
 * 放置一个新数据,动作会根据状态有三种:
 *  当前如果在IDLE中,就放入数据,直接启动发送
 *  当前如果在BUSY中,放入数据,等待处理完后发送数据
 *  当前如果在RESEND_WAIT中,取消重发数据,发送最新数据
 * @param newVal
 * @param timeout
 */
QueueWriteOnce.prototype.push = function (ep,newVal, uuid, timeout) {


    let target= {ep:ep,value:newVal,timeout:timeout || 1000,uuid:uuid};


    if(uuid){  //如果有uuid,就会根据uuid发送
        let currentValue = this.targetValue.length ;
        (function(that,_target,valueIndex,_timeout){

            _target.timerHandle = setTimeout(function(){
                that.targetValue[valueIndex] = null;
                that.emit('resp-'+uuid,{success:false,reason:'写入超时'});
            },_timeout||1000);
        })(this,target,currentValue,timeout);
    }

    this.targetValue.push(target);
    //调用一下执行,如果当前正在执行就,就什么都没干
    this.run();
    return Q();
}
/**
 * 简单的任务队列
 * @param options
 * @constructor
 */
function JobQueue(options){
    Event.EventEmitter.call(this);
    this.targetValue = [];
    this.state = STATE.IDLE;
    this.consumer = options.consumer;
    this.paused = false;
    this.interval = options.interval || 0;
    this.timeout = options.timeout || 100;
    this.timehandle = null;
    let self = this;
    this.run = function(){

        if(this.paused){
            if(this.timehandle){
                clearTimeout(this.timehandle);
                this.timehandle = null;
            }
            this.timehandle = setTimeout(function(){
                self.state = STATE.IDLE;
                self.run();
            },this.timeout);
        }else{
            if (self.targetValue && self.targetValue.length > 0) {
                if(self.state === STATE.IDLE){
                    let target = self.targetValue.shift();
                    if (self.consumer ) {
                        self.state = STATE.BUSY;

                        self.__worker= Q().then(function(){
                            //队列中的所有的待写入操作返回

                            return self.consumer(target.handle);
                        }).then(function(value){
                            if(target.uuid){
                                self.emit('resp-'+target.uuid,{success:true,result:value})
                            }
                            if(self.timehandle){
                                clearTimeout(self.timehandle);
                                self.timehandle = null;
                            }

                            self.timehandle =setTimeout(function(){
                                self.state = STATE.IDLE;
                                self.run();
                            },self.interval)


                        }).catch(function(e){
                            if(target.uuid){
                                self.emit('resp-'+target.uuid,{success:false,reason:e});
                            }
                            //    console.error('error in writing Value:',e); // 这个不应该出现,只有在非正常的情况下才会如此

                            if(self.targetValue.length > 0){
                                if(self.timehandle){
                                    clearTimeout(self.timehandle);
                                    self.timehandle = null;
                                }
                                self.timehandle =setTimeout(function(){
                                    self.state = STATE.IDLE;
                                    self.run();
                                },self.timeout)

                            }else{
                                self.state = STATE.IDLE;
                            }
                        });
                    }
                }

            }else{
                self.state = STATE.IDLE;
            }
        }


    }
}
util.inherits(JobQueue,Event.EventEmitter);

JobQueue.prototype.push = function(target ,timeout){
    let uuid = Math.random().toPrecision(12);

    

    this.targetValue.push({uuid:uuid,handle:target});

    this.run();
    return TimedQ.TimedEvent('resp-'+uuid,this,timeout || 500);
}
JobQueue.prototype.pause = function () {
    this.paused = true;
}
JobQueue.prototype.resume = function () {
    this.paused = false;
}
module.exports.STATE  = STATE;
module.exports.WriteQueue = QueueWriteOnce;
module.exports.JobQueue = JobQueue;
