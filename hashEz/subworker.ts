import sparkMD5 from 'spark-md5';

const tasks = [] as IFileHandleThread[];
let isWorking = false;
let startWorkingTime = 0;

// eslint-disable-next-line no-restricted-globals
self.onmessage = (event) => {
  const { channel, data } = event.data;

  switch (channel) {
    case 'inspection':
      // eslint-disable-next-line no-restricted-globals
      self.postMessage({
        threadCode: 0,
        channel: 'inspection',
        threadData: {
          tasks,
          isWorking,
          startWorkingTime,
          workTimeElapse: isWorking ? Date.now() - startWorkingTime : 0,
        },
      });
      break;

    case 'hash':
      isWorking = true;
      startWorkingTime = Date.now();
      console.log('worker接收的数据：', data);
      const { taskId, chunks } = data;
      const spark = new sparkMD5.ArrayBuffer();

      const appendToSpark = async (file: File) =>
        new Promise<void>((resolve) => {
          const fileReader = new FileReader();
          fileReader.readAsArrayBuffer(file);
          fileReader.onload = (e) => {
            // console.log(e.target.result);
            spark.append(e.target?.result as ArrayBuffer);
            resolve();
          };
        });
      let count = 0;
      const workLoop = async () => {
        while (count < chunks.length) {
          // eslint-disable-next-line no-await-in-loop
          await appendToSpark(chunks[count].file);
          count++;
          if (count >= chunks.length) {
            const fileHash = spark.end();
            // 计算完成后，通过postMessage通知主线程
            // eslint-disable-next-line no-restricted-globals
            self.postMessage({
              threadCode: 0,
              channel: 'hash',
              threadData: {
                taskId,
                fileHash,
              },
            });
          }
        }
      };
      workLoop();
      break;

    default:
      console.log('没有相应的任务方法');
  }
};
