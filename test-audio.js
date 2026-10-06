const https = require('https');
https.get('https://cdn.pixabay.com/download/audio/2022/01/18/audio_985b882eb7.mp3', (res) => {
  console.log(res.statusCode);
});
