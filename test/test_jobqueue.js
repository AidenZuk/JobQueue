/**
 * Created by zhuqizhong on 17-8-27.
 */
const assert = require("assert");
const Q = require('q');
const JobQueue = require('../index').JobQueue;
var result_test;

function consumer(data){

}
describe('JOB Queue Test', function(){
    describe('normal operation', function(){
        it('process one by one', function(done){
            function consumer(data) {
                return Q().then(()=>{
                    data.value++;
                })
            }

            let queue = new JobQueue({consumer:consumer});

            let data = {value:0};

            queue.push(data);
            queue.push(data);
            queue.push(data);
            queue.push(data);
            setTimeout(()=>{
                if(data.value !== 4){
                    throw new Error(`error data:${data.value}`);
                }else{
                    done();
                }
            },100)


        });
        it('process test timeout ', function(done){
            function consumer(data) {
                return Q().delay(200).then(()=>{
                    data.value++;
                })
            }

            let queue = new JobQueue({consumer:consumer});

            let data = {value:0};

            queue.push(data,300).then(()=>{
                return queue.push(data,100)
            }).then(function(){
                throw new Error('should be reject here');
            },function (exception) {
                if(data.value !== 1){
                    throw new Error(`error data:${data.value}`);
                }else{
                    done();
                }
            })




        })

        it('process test different timeout ', function(done){
            function consumer(data) {
                return Q().delay(200).then(()=>{
                    console.log('timeout:',new Date().getTime());
                    data.value++;
                })
            }

            let queue = new JobQueue({consumer:consumer});

            let data = {value:0};

            queue.push(data,300);

            queue.push(data,100).then(function(){
                throw new Error('should be reject here');
            },function (exception) {
                if(data.value !== 0){
                    throw new Error(`error data:${data.value}`);
                }else{
                    done();
                }
            })




        });
        it('process test pause/resume ', function(done){
            function consumer2(data) {
                return Q().delay(200).then(()=>{
                    console.log(new Date().getTime());
                    data.value++;
                })
            }

            let queue = new JobQueue({consumer:consumer2});

            let data2 = {value:0};

            queue.push(data2,300);
            queue.push(data2,300);
            queue.push(data2,300);
            queue.push(data2,300);
            queue.push(data2,300);
            setTimeout(()=>{
                if(data2.value !== 2) {
                    throw new Error(`error data:${data2.value}`);
                }else{
                    queue.pause();
                    setTimeout(()=>{
                        if(data2.value !== 3) { //这时候已经在处理第三个了
                            throw new Error(`pause not work, error data:${data2.value}`);
                        }else{
                            queue.resume();
                            setTimeout(()=>{
                                if(data2.value !== 5){
                                    throw new Error(`resume not work, error data:${data2.value}`);
                                }else{
                                    done();
                                }
                            },600)
                        }
                    },400)
                }
            },500);
        });
    })
});