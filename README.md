# JobQueue
utils for long time jobs
##JobQueue A simple job queue to process data one by one.
    let queue = new JobQueue({consumer:xxx,interval:xxx});
consumer is a process function with protocol as: function(data){...}, comsumer must return a promise;
interval is the time between two jobs execution.

### how to work
ask consumer to process data:
    
    queue.push(somedata);
    queue.push(next_data);

next_data will be process only when somedata is processed;

    return queue.push(somedata).then(()=>{
        queue.push(next_data)
    })
    
Similar as above, but a promise will be returned;

Add timeout for procedure:

   return queue.push(somedata,500).then(()=>{
           queue.push(next_data,1000)
       })
The promise will reject 'timeout' exception when somedata not have been processed in 500 ms, same as next_data;         
           
    queue.push(somedata,500);
    return queue.push(next_data,1000);
next_data should be processed in 1000ms, including the process time of somedata;
    queue.pause  pause proceed after current one finished.
    queue.resume resume to start proceed data
    
##JobQueue 一个简单的任务队列，实现逐个处理数据的功能

    let queue = new JobQueue({consumer:xxx,interval:xxx});
 
    
consumer是一个处理函数，其函数原型为function(data){ return Promise;},一定返回一个promise
interval 是两次处理之间的时间间隔
    
需要队列处理数据的时候:

    queue.push(somedata);
    queue.push(next_data);
     
队列会在somedata处理完毕后，自动处理next_data

    queue.pause  暂停处理数据
    queue.resume 恢复处理数据


#WriteQueue simple queue for update specified state  
# !!not tested!!

Some state, such as light state in smarthome, if multiple command is sent in a short time, it would be nonsense to switch the light multi-times.
 Let's think about such command sequence:
 
        on--> off -->off -->on -->off-->on

 suppose controlling the light will cause 500ms to 2 seconds due to different network situation,when first command (on) is processed an returned there are many request pended in queue
  but the last command is same as current state. So all other command should be ignored. 

the class WriteQueue is build for this propose:

       let writeQueue = new WriteQueue({consumer:xxx});
consumer is a process function with protocol as: function(data){...}, comsumer must return a promise;

### how to work
ask consumer to process data:
    
    writeQueue.push(somedata,uuid,timeout);
    writeQueue.push(next_data,uuid,timeout);
    writeQueue.push(next_data2,uuid,timeout);

When somedata is process and returned writeQueue will check all data in its cache(next_data,next_data2);
In this case, next_data will be ignored, and if next_data2 is same as somedata, no more action will execute; if different, comsumer(next_data2) will be called.

`timeout` is used to set the most execute time;
 
 `'resp-'+uuid` event will fired when processed, with data:
 
    {
        success: true/false,  exection state  
        reason: xxx           when failed, this is the reason
    }
    
