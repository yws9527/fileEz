import { IFileChunkList, IFileHandleThread, IFileHandleOptions, IFileMessageEventData, Recordable } from "../types";

export default class WorkerHash {
  setProgress: (n: number) => number;
  maximumWorkTime: number = 0;
  inspectIntervalTime: number = 0;
  maximumThreadsNumber: number = 4;
  chunks = [] as IFileChunkList[];
  threads = [] as IFileHandleThread[];

  constructor(
    chunks: IFileChunkList[],
    setProgress: (n: number) => number,
    option = {} as IFileHandleOptions
  ) {
    const {
      maximumWorkTime = 30 * 1000,
      inspectIntervalTime = 10 * 1000,
      defualtChunkSize = 1 * 1024 * 1024,
    } = option;

    this.chunks = chunks;
    this.setProgress = setProgress;
    this.maximumWorkTime = maximumWorkTime;
    this.threads = [] as IFileHandleThread[];
    this.inspectIntervalTime = inspectIntervalTime;
    this.maximumThreadsNumber = window.navigator.hardwareConcurrency || 4;
    this.init();
  }
  /*
    {
      threadCode: 0,  // 约定为0，错误消息为1
      threadData: {taskId, data, code, msg}, // 表示消息真正的数据载体对象, 错误情况时只有 taskId
      threadMsg:  'xxxxx', // 表示消息错误的报错信息。非必须的
      channel: 'fetch', // 表示数据频道，因为我们可能通过子线程做其他工作
    }
  */

  init() {
    for (let i = 0; i < this.maximumThreadsNumber; i++) {
      this.createThread(i);
    }
    setInterval(() => this.inspectThreads(), this.inspectIntervalTime);
  }

  // 创建线程池
  createThread(i: number) {
    // Initialize a webWorker and get its reference.
    // const thread = work(require.resolve('./fetch.worker.js'));
    const thread: IFileHandleThread = new Worker(
      new URL('./subworker.js', import.meta.url)
    );
    // Bind message event.
    // 子线程计算完成后，会将切片返回主线程
    thread.addEventListener('message', (event: MessageEvent) => {
      this.messageHandler(event, thread);
    });
    // Stick the id tag into thread.
    thread.id = i;
    // To flag the thread working status, busy or idle.
    thread.busy = false;
    // Record all fetch tasks of this thread, currently it is aimed to record reqPromise.
    thread.taskMap = {};
    // The id tag mentioned above is the same with the index of this thread in threads array.
    this.threads[i] = thread;
  }

  // 消息处理
  messageHandler(event: MessageEvent, thread: IFileHandleThread) {
    const { channel, threadCode, threadData, threadMsg } =
      event.data as IFileMessageEventData;
    let reqPromise;
    let { taskId, data } = threadData;
    // Thread message ok.
    if (threadCode === 0) {
      switch (channel) {
        case 'fetch':
          const { code, msg } = threadData;
          reqPromise = thread.taskMap?.taskId;
          if (reqPromise) {
            // Handle the upper fetch promise call;
            if (code === 0) {
              reqPromise.resolve(data);
            } else {
              reqPromise.reject({ code, msg });
            }
            // Remove this fetch task from taskMap of this thread.
            (thread.taskMap as Recordable)[taskId] = null;
          }
          // Set the thread status to idle.
          thread.busy = false;
          break;

        case 'inspection':
          // console.info(`Inspection info from thread, details: ${JSON.stringify(threadData)}`);
          // Give some tips about abnormal worker thread.
          if (data?.isWorking && data?.workTimeElapse > this.maximumWorkTime) {
            console.warn(
              `Fetch worker thread ID: ${
                thread.id
              } is hanging up, details: ${JSON.stringify(
                threadData
              )}, it will be terminated.`
            );
            this.terminateZombieThread(thread);
          }
          break;

        case 'hash':
          reqPromise = (thread.taskMap as Recordable)[taskId];
          const fileHash = data?.fileHash;
          if (reqPromise) {
            // Handle the upper fetch promise call;
            this.setProgress(100);
            reqPromise.resolve
              ? reqPromise.resolve(fileHash)
              : reqPromise(fileHash);
            // Remove this fetch task from taskMap of this thread.
            (thread.taskMap as Recordable)[taskId] = null;
          }
          // Set the thread status to idle.
          thread.busy = false;
          break;

        default:
          break;
      }
    } else {
      // Thread message come with error.
      // Set the thread status to idle.
      thread.busy = false;
      reqPromise = (thread.taskMap as Recordable)[taskId];
      reqPromise?.reject({ code: threadCode, msg: threadMsg });
    }
  }

  // 过滤出闲置中的子线程，取第一个来下发任务
  dispatchThread(reqPromise: () => void) {
    // dispatchThread({ url, options }, reqPromise) {
    // Firstly get the idle thread in pools.
    let thread = this.threads.filter((thread) => !thread.busy)[0];
    // If there is no idle thread, fetch in main thread.
    if (thread) {
      // Stick the reqPromise into taskMap of thread.
      const taskId = Date.now();
      (thread.taskMap as Recordable)[taskId] = reqPromise;
      // thread.taskMap[taskId] = reqPromise;
      // // Dispatch fetch work to thread.
      // thread.postMessage({
      //   channel: 'fetch',
      //   threadData: {
      //     taskId
      //     data: {
      //       url,
      //       options,
      //     },
      //   }
      // });

      thread.postMessage({
        channel: 'hash',
        threadData: {
          taskId,
          data: {
            chunks: this.chunks, // 是否将全部chunks给这个进程计算
          },
        },
      });
      thread.busy = true;
    } else {
      // thread = fetchInMainThread({ url, options }); // 无空闲线程，怎么处理？？？？？
    }
  }

  // 检查线程是否健康
  inspectThreads() {
    if (this.threads.length > 0) {
      this.threads.forEach((thread) => {
        // console.info(`Inspection thread ${thread.id} starts.`);
        thread.postMessage({
          channel: 'inspection',
          threadData: {
            data: {},
            taskId: thread.id,
          },
        });
      });
    }
  }

  // 终结僵尸进程
  terminateZombieThread(thread: IFileHandleThread) {
    const { id } = thread;
    const index = this.threads.findIndex((item) => item.id === id);
    thread.terminate();
    this.threads.splice(index, 1);
    this.createThread(id as number);
  }
}
