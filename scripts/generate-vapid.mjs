import {generateKeyPairSync} from 'node:crypto';

const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const publicJwk=publicKey.export({format:'jwk'});
const privateJwk=privateKey.export({format:'jwk'});

const x=Buffer.from(publicJwk.x,'base64url');
const y=Buffer.from(publicJwk.y,'base64url');
const publicBytes=Buffer.concat([Buffer.from([4]),x,y]);

console.log('');
console.log('VAPID_PUBLIC_KEY');
console.log(publicBytes.toString('base64url'));
console.log('');
console.log('VAPID_PRIVATE_KEY');
console.log(privateJwk.d);
console.log('');
console.log('Store both values as Cloudflare secrets. Keep the private key private.');
