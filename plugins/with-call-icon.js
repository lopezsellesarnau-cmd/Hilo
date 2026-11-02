// Hilo's logo on the iPhone call screen (CallKit draws it white from the image's transparency).
// ios/ is generated, so the image goes into the asset catalog here on every prebuild.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = (config) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      const dir = path.join(platformProjectRoot, projectName, 'Images.xcassets', 'CallIcon.imageset');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(projectRoot, 'assets/images/call-icon.png'), path.join(dir, 'call-icon.png'));
      fs.writeFileSync(
        path.join(dir, 'Contents.json'),
        JSON.stringify({
          images: [{ idiom: 'universal', filename: 'call-icon.png' }],
          info: { version: 1, author: 'expo' },
          properties: { 'template-rendering-intent': 'template' },
        }),
      );
      return config;
    },
  ]);
