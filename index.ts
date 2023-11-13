import sparkMD5 from 'spark-md5';
import CreateChunks from './chunksEz';
// 通过js Worker多线程方式获取hash
// import WorkerHash from './hashEz/workerHash';
// 通过js Request方式获取hash
import RequestHash from './hashEz/requestHash';
import { IFileEz } from './types';

const fileEz = {
  state: 0, // 0 - <= 100MB 直传OSS   1 - > 100MB 切片上传OSS
  hash: '',
  chunks: [],
} as IFileEz;

// 获取读取进度
function setProgress(progress: number) {
  console.log('progress: ', progress);
  return progress;
}

// 获取文件size
function fileSize(file: File) {
  return parseFloat((file.size / 1024 / 1024).toFixed(2));
}

// 处理上传文件 大于100M
// 切片，秒传，续传，并发
async function fileSizeMT100MHandle(file: File): Promise<IFileEz> {
  const createChunks = new CreateChunks(file, setProgress);
  const chunks = await createChunks.createFileChunks();
  fileEz.state = 1;

  // 方式一
  const requestHash = new RequestHash(chunks, setProgress);
  const hash = (await requestHash.getFileHash()) as string;
  chunks.map((item: any) => {
    item.hash = hash;
    return item;
  });
  fileEz.hash = hash;
  fileEz.chunks = chunks;
  return fileEz;

  // 方式二
  // const workerhash = new WorkerHash(chunks, setProgress);
  // return new Promise((resolve, reject) => {
  //   workerhash.dispatchThread((res) => {
  //     const hash = res;
  //     chunks.map(item => item.hash = hash);
  //     fileEz.hash = hash;
  //     fileEz.chunks = chunks;
  //     resolve(fileEz);
  //   });
  // });
}

// 处理上传文件 <= 100M
// 秒传
function fileSizeLT100MHandle(file: File): Promise<IFileEz> {
  if (fileSize(file) <= 100) {
    return new Promise((resolve) => {
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        const spark = new sparkMD5.ArrayBuffer();
        spark.append(e.target?.result as ArrayBuffer);
        fileEz.state = 0;
        fileEz.chunks = [];
        fileEz.hash = spark.end();
        resolve(fileEz);
      };
      fileReader.readAsArrayBuffer(file);
    });
  }

  return fileSizeMT100MHandle(file);
}

// 职责链模式设计文件处理策略
function fileSizeHandle(file: File): Promise<IFileEz> {
  return fileSizeLT100MHandle(file);
}

export default fileSizeHandle;
