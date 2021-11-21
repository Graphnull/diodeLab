

let Dataset = require('nodleten').Dataset;
var width = 1024;
var height = 768;
var sharp = require('sharp/lib/index')
var path = require('path')
let openDataset = require('nodleten').openDataset;
let fs = require('fs')
let http = require('http');
let tar = require('tar');
let allFiles = require('./../drive/MyDrive/normalMap/files.json').map(p=>p.slice(0,64))

//download diode dataset
let downloadNormalDataset = async () => {

  let files = fs.readdirSync('./');
  if (files.indexOf('train') > -1) {
    files = fs.readdirSync('./train/indoors/scene_00000/scan_00000/');
    if (files.filter(f => f.slice(-10) === 'normal.npy').length > 0) {
      return;
    }
  }


  let interval;
  try {
    let len = 0;
    let bcount = 0;
    interval = setInterval(() => {
      console.log(((bcount / len) * 100).toFixed(2) + '% ' + bcount + ' ' + len)
    }, 5000)
    let fsPromises = [];
    await new Promise((resolve) => {
      const rr = http.request({
        host: 'diode-dataset.s3.amazonaws.com',
        path: '/train_normals.tar.gz'
      }, (req) => {
        len += parseInt(req.headers['content-length']);
        req.on('data', (data) => { bcount += data.length; })

        req
          .pipe(new tar.Parse({
            filter: (path) => (path.slice(-4) === '.npy') && path.indexOf('outdoors') < 0,
            onentry: (entry) => {

              fsPromises.push(new Promise((resfs) => {
                let data = [];
                entry.on('data', (d) => { data.push(d) })
                entry.on('end', async () => {
                  let nfile = Buffer.concat(data).slice(-(width * height * 3 * 4))
                  let ndata = new Float32Array(nfile.buffer.slice(nfile.byteOffset, nfile.byteOffset + nfile.byteLength));
                  ndata = Buffer.from(ndata.map(v => (v + 1) * 127))
                  await fs.promises.mkdir(entry.path.split('/').slice(0, -1).join('/') + '/', { recursive: true })
                  await fs.promises.writeFile(entry.path, ndata)
                  resfs()
                })
              }))

            }
          }))
        req.on('end', resolve)
      });
      rr.end()
    })
    await Promise.all(fsPromises)
    clearInterval(interval);
  } catch (err) {
    clearInterval(interval);
    throw err;
  }

}


module.exports.getNormal = async function getNormal(cpath) {
  let files = fs.readdirSync('./');
  if (global.normalDataset) {
    global.normalDataset.destroy();
    delete global.normalDataset;
  }
  if (files.indexOf('normal.bin') > -1 &&
    files.indexOf('normal.ndlt') > -1 &&
    (await fs.promises.stat('normal.bin')).size === 13526342413 &&
    (await fs.promises.stat('normal.ndlt')).size === 101483
  ) {
    global.normalDataset = await openDataset('normal');

  } else {
    let cfiles = fs.readdirSync(cpath);
    let binf = cfiles.find(f => f === 'normal.bin');
    let ndltf = cfiles.find(f => f === 'normal.ndlt');
    if (binf && ndltf) {
      await fs.promises.copyFile(path.resolve(cpath,'./normal.bin'),'./normal.bin' );
      await fs.promises.copyFile(path.resolve(cpath,'./normal.ndlt'),'./normal.ndlt' );
      global.normalDataset = await openDataset('normal');
    } else {
      await downloadNormalDataset()
      var folder = 'train'
      let scenes = fs.readdirSync(folder + '/indoors/').map(v => folder + '/indoors/' + v);
      let scans = [].concat(...scenes.map(folder => fs.readdirSync(folder).map(v => folder + '/' + v)))
      let files = [].concat(...scans.map(folder => fs.readdirSync(folder).map(v => folder + '/' + v)));

      var normalDataset = new Dataset({ name: 'normal', shape: [height, width, 3] });
      try {
        for (let i = 0; i !== files.length; i++) {
          let file = files[i];
          if (file.slice(-11) === '_normal.npy') {
            let data = fs.readFileSync(file);
            let nfile = Int8Array.from((new Float32Array(data)).map(v => v - 127));
            normalDataset.push(nfile)
            if (i % 64 === 0) {
              console.log(i)
            }
          }

        }
        await normalDataset.writeHeaderFile()
        await bucket.upload('./normal.bin')
        await bucket.upload('./normal.ndlt')
        global.normalDataset = normalDataset;
        /*
        for (let i = 0; i !== files.length; i++) {
          let file = files[i];
          if (file.slice(-11) === '_normal.npy') {
            await fs.promises.unlink(file)
          }
        }*/
      } catch (err) {
        console.log(err)
        normalDataset.destroy()
      }
    }
  }
}
let templ = 0;
//download diode dataset
let downloadDataset = async () => {

  let files = fs.readdirSync('./');
  if (files.indexOf('train') > -1) {
    return;
  }
  let len = 0;
  let bcount = 0;
  let interval = setInterval(() => {
    console.log(((bcount / len) * 100).toFixed(2) + '% ' + bcount + ' ' + len)
  }, 5000)
  
  let fsPromises = [];
  await new Promise((resolve) => {
    const rr = http.request({
      host: 'diode-dataset.s3.amazonaws.com',
      path: '/train.tar.gz'
    }, (req) => {
      len += parseInt(req.headers['content-length']);
      req.on('data', (data) => { bcount += data.length; })
      let tarStream = tar.x({filter:(path)=>{
        if(templ<20){
        console.log(path.slice(0,64),allFiles[0])
        }
        let fp = path.slice(0,64)
        templ++;
        return allFiles.find(v=>fp===v)&&path.indexOf('outdoors') < 0
      }})
      req.pipe(tarStream)
      tarStream.on('end', resolve)
    });
    rr.end()
  })
  clearInterval(interval)

}

module.exports.getMask = async function getMask(cpath) {
  let files = fs.readdirSync('./');
  if (global.maskDataset) {
    global.maskDataset.destroy();
    delete global.maskDataset;
  }
  if (files.indexOf('mask.bin') > -1 &&
    files.indexOf('mask.ndlt') > -1 &&
    (await fs.promises.stat('mask.bin')).size === 59890990 &&
    (await fs.promises.stat('mask.ndlt')).size === 83498
  ) {
    global.maskDataset = await openDataset('mask');

  } else {
    
    let cfiles = fs.readdirSync(cpath);
    let maskhbin = cfiles.find(f => f === 'mask.bin');
    let maskndlt = cfiles.find(f => f === 'mask.ndlt');
    if (maskhbin && maskndlt) {
      await fs.promises.copyFile(path.resolve(cpath,'./mask.bin'),'./mask.bin' );
      await fs.promises.copyFile(path.resolve(cpath,'./mask.ndlt'),'./mask.ndlt' );
      global.maskDataset = await openDataset('mask');
    } else {
      await downloadDataset()
      var folder = 'train'
      let scenes = fs.readdirSync(folder + '/indoors/').map(v => folder + '/indoors/' + v);
      let scans = [].concat(...scenes.map(folder => fs.readdirSync(folder).map(v => folder + '/' + v)))
      let files = [].concat(...scans.map(folder => fs.readdirSync(folder).map(v => folder + '/' + v)));

      var maskDataset = new Dataset({ name: 'mask', shape: [height, width, 1], type: 'Buffer' });
      try {
        for (let i = 0; i !== files.length; i++) {
          let file = files[i];
          if (file.slice(-15) === '_depth_mask.npy') {
            let data = fs.readFileSync(file).slice(-(width * height * 1 * 4));
            let nfile = Buffer.from(new Float32Array(data.buffer, data.byteOffset, data.byteLenght));
            maskDataset.push(nfile)
            if (i % 64 === 0) {
              console.log(i)
            }
          }

        }
        await maskDataset.writeHeaderFile()
        await bucket.upload('./mask.bin')
        await bucket.upload('./mask.ndlt')
        global.maskDataset = maskDataset;
        for (let i = 0; i !== files.length; i++) {
          let file = files[i];
          if (file.slice(-15) === '_depth_mask.npy') {
            await fs.promises.unlink(file)
          }
        }
      } catch (err) {
        console.log(err)
        maskDataset.destroy()
      }
    }
  }
}

module.exports.getRgb = async function getRgb(cpath) {
  let files = fs.readdirSync('./');
  if (global.rgbDataset) {
    global.rgbDataset.destroy();
    delete global.rgbDataset;
  }
  if (files.indexOf('rgb.bin') > -1 &&
    files.indexOf('rgb.ndlt') > -1 &&
    (await fs.promises.stat('rgb.bin')).size === 19175079352 &&
    (await fs.promises.stat('rgb.ndlt')).size === 98294
  ) {
    global.rgbDataset = await openDataset('rgb');

  } else {
    
    let cfiles = fs.readdirSync(cpath);
    let binf = cfiles.find(f => f === 'rgb.bin');
    let ndltf = cfiles.find(f => f === 'rgb.ndlt');
    if (binf && ndltf) {
      await fs.promises.copyFile(path.resolve(cpath,'./rgb.bin'),'./rgb.bin' );
      await fs.promises.copyFile(path.resolve(cpath,'./rgb.ndlt'),'./rgb.ndlt' );
      global.rgbDataset = await openDataset('rgb');
    } else {

      await downloadDataset()
      var folder = 'train'
      let scenes = fs.readdirSync(folder + '/indoors/').map(v => folder + '/indoors/' + v);
      let scans = [].concat(...scenes.map(folder => fs.readdirSync(folder).map(v => folder + '/' + v)))
      let files = [].concat(...scans.map(folder => fs.readdirSync(folder).map(v => folder + '/' + v)));

      var rgbDataset = new Dataset({ name: 'rgb', shape: [height, width, 3], type: 'Buffer' });
      try {
        for (let i = 0; i !== files.length; i++) {
          let file = files[i];
          if (file.slice(-4) === '.png') {
            let nfile = await sharp(file).raw().toBuffer()
            rgbDataset.push(nfile)
            if (i % 64 === 0) {
              console.log(i)
            }
          }

        }
        await rgbDataset.writeHeaderFile()
        console.log('uploading...')
        await bucket.upload('./rgb.bin')
        await bucket.upload('./rgb.ndlt')
        global.rgbDataset = rgbDataset;
        for (let i = 0; i !== files.length; i++) {
          let file = files[i];
          if (file.slice(-4) === '.png') {
            await fs.promises.unlink(file)
          }
        }
      } catch (err) {
        console.log(err)
        rgbDataset.destroy()
      }
    }
  }
}

module.exports.getDepth = async function getDepth(cpath) {
  //prepare depth

  let files = fs.readdirSync('./');
  if (global.depthDataset) {
    global.depthDataset.destroy();
    delete global.depthDataset;
  }
  if (files.indexOf('depth.bin') > -1 &&
    files.indexOf('depth.ndlt') > -1 &&
    (await fs.promises.stat('depth.bin')).size === 2210499609 &&
    (await fs.promises.stat('depth.ndlt')).size === 100656
  ) {
    global.depthDataset = await openDataset('depth');

  } else {
    
    let cfiles = fs.readdirSync(cpath);
    let binf = cfiles.find(f => f === 'depth.bin');
    let ndltf = cfiles.find(f => f === 'depth.ndlt');
    if (binf && ndltf) {
      await fs.promises.copyFile(path.resolve(cpath,'./depth.bin'),'./depth.bin' );
      await fs.promises.copyFile(path.resolve(cpath,'./depth.ndlt'),'./depth.ndlt' );
      global.depthDataset = await openDataset('depth');
    } else {
      await downloadDataset()
      var folder = 'train'
      let scenes = fs.readdirSync(folder + '/indoors/').map(v => folder + '/indoors/' + v);
      let scans = [].concat(...scenes.map(folder => fs.readdirSync(folder).map(v => folder + '/' + v)))
      let files = [].concat(...scans.map(folder => fs.readdirSync(folder).map(v => folder + '/' + v)));

      var depthDataset = new Dataset({ name: 'depth', shape: [height, width, 1], type: 'Uint16Array' });
      try {
        for (let i = 0; i !== files.length; i++) {
          let file = files[i];
          if (file.slice(-10) === '_depth.npy') {
            let data = fs.readFileSync(file).slice(-(width * height * 1 * 4));
            let nfile = new Uint16Array((new Float32Array(data.buffer, data.byteOffset, data.byteLenght)).map(v => v * 100));
            depthDataset.push(nfile)
            if (i % 64 === 0) {
              console.log(i)
            }
          }

        }
        await depthDataset.writeHeaderFile()
        console.log('uploading...')
        await bucket.upload('./depth.bin')
        await bucket.upload('./depth.ndlt')
        global.depthDataset = depthDataset;
        for (let i = 0; i !== files.length; i++) {
          let file = files[i];
          if (file.slice(-10) === '_depth.npy') {
            await fs.promises.unlink(file)
          }
        }
      } catch (err) {
        console.log(err)
        depthDataset.destroy()
      }
    }
  }
}
