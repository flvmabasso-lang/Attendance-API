// lib/rekognition.js
// Encapsula as chamadas à AWS Rekognition. Nenhuma chave secreta passa pelo
// frontend — só este ficheiro, que corre no servidor, é que fala com a AWS.

const { RekognitionClient, CompareFacesCommand, DetectFacesCommand } = require('@aws-sdk/client-rekognition');

const client = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function base64ToBuffer(dataUrl) {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Buffer.from(base64, 'base64');
}

// Devolve true se conseguir detetar pelo menos um rosto na foto.
// Usado no cadastro, para recusar fotos sem rosto visível.
async function hasFace(photoBase64) {
  const command = new DetectFacesCommand({
    Image: { Bytes: base64ToBuffer(photoBase64) },
  });
  const result = await client.send(command);
  return (result.FaceDetails || []).length > 0;
}

// Compara duas fotos e devolve a percentagem de semelhança (0-100).
// Devolve null se a AWS não conseguiu comparar (normalmente por não
// encontrar nenhum rosto numa das duas imagens).
async function compareFaces(sourceBase64, targetBase64) {
  const command = new CompareFacesCommand({
    SourceImage: { Bytes: base64ToBuffer(sourceBase64) },
    TargetImage: { Bytes: base64ToBuffer(targetBase64) },
    SimilarityThreshold: 1, // pedimos tudo; o limite de decisão é nosso, não da AWS
  });

  try {
    const result = await client.send(command);
    const best = (result.FaceMatches || []).sort((a, b) => b.Similarity - a.Similarity)[0];
    return best ? best.Similarity : 0;
  } catch (err) {
    if (err.name === 'InvalidParameterException') {
      // Tipicamente: não foi encontrado nenhum rosto numa das imagens
      return null;
    }
    throw err;
  }
}

module.exports = { hasFace, compareFaces };
