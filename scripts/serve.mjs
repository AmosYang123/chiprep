// Minimal static server for previewing dist/ in a real browser.
// Module scripts do not load over file://, so the app only runs when served over HTTP.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.argv[2]??process.env.PORT??8080);
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};

const app=createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const rel=normalize(path==='/'?'index.html':path==='/phone'?'phone.html':path.slice(1));
  if(rel.startsWith('..')){res.writeHead(403).end('Forbidden');return}
  try{
    const body=await readFile(join(root,rel));
    res.writeHead(200,{'content-type':types[extname(rel)]??'application/octet-stream','cache-control':'no-store'}).end(body);
  }catch{res.writeHead(404).end('Not found')}
});

export default function start(listenPort=port){
  return app.listen(listenPort,'127.0.0.1');
}
if(process.argv[1]===fileURLToPath(import.meta.url))start().on('listening',function(){console.log('Tīng running at http://localhost:'+this.address().port)});
