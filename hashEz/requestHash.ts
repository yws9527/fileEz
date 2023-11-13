import sparkMD5 from 'spark-md5';

export default class RequestHash {
  setProgress: (n: number) => number;
  chunks = [] as IFileChunkList[];

  constructor(chunks: IFileChunkList[], setProgress: (n: number) => number) {
    this.chunks = chunks;
    this.setProgress = setProgress;
  }

  async getFileHash() {
    return new Promise((resolve) => {
      let count = 0;
      const spark = new sparkMD5.ArrayBuffer();
      const appendToSpark = async (file: Blob) =>
        new Promise<void>((resolve1) => {
          const reader = new FileReader();
          reader.readAsArrayBuffer(file);
          reader.onload = (e: ProgressEvent<FileReader>) => {
            spark.append(e.target?.result as ArrayBuffer);
            resolve1();
          };
        });
      const workLoop = async (deadline: { timeRemaining: () => number }) => {
        // 块数没有计算完，并且当前帧还没结束
        while (count < this.chunks.length && deadline.timeRemaining() > 1) {
          // eslint-disable-next-line no-await-in-loop
          await appendToSpark(this.chunks[count].chunk);
          // eslint-disable-next-line no-plusplus
          count++;
          this.setProgress(
            Number(((100 * count) / this.chunks.length).toFixed(2))
          );
          if (count >= this.chunks.length) resolve(spark.end());
        }
        window.requestIdleCallback(workLoop);
      };
      window.requestIdleCallback(workLoop);
    });
  }
}
