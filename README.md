# diodeLab
Tools for work with https://diode-dataset.org/ dataset

example

```js
 
  const fs = require('fs');
  sh(`npm i @google-cloud/storage`)
  let bucketName = 'diode'
  //load google cloud storage access file
  process.env.GOOGLE_APPLICATION_CREDENTIALS = fs.readdirSync('./').filter(v => v.slice(0, 5) === bucketName && v.slice(-5) === '.json')[0]
 
 if(!process.env.GOOGLE_APPLICATION_CREDENTIALS){
    throw new Error('storage file not found')
 }
  const Storage  = require('@google-cloud/storage').Storage;
 
  const storage = new Storage();
  var bucket= await storage.bucket(bucketName)

let download = require('./diodeLab/download')
await download.getMask();
await download.getDepth();
await download.getRgb();

// after use rgbDataset, maskDataset, depthDataset

```
