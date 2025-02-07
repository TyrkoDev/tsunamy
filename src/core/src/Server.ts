import { Configuration } from './types/Configuration';
import { Class } from './types/Class';
import { Router } from './Router';
import { Console } from './Console';
import fs from 'fs';
import https from 'https';
import http from 'http';

const MimeTypes: any = {
  html: 'text/html',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  js: 'text/javascript',
  css: 'text/css'
};

export class Server {

  currentServerHttps: any;
  currentServerHttp: any;

  bootstrapModule(module: Class, CONFIGURATION: Configuration) {
    function app(req: any, res: any): void {
      const bodyChunk: Uint8Array[] = [];
      let body: any;
      req.on('error', (err: any) => {
        console.error(err);
      }).on('data', (chunk: any) => {
        bodyChunk.push(chunk);
      }).on('end', async () => {
        body = JSON.parse(Buffer.concat(bodyChunk).toString() || '{}');
        const route = Router.resolve(req.url, req.method);
        if (!route.error) {
          if (route.isStaticFile) {// If static files
            serveStaticFiles(req, res);
            return;
          }
          // call function
          const result = await Router.executeRouteFunction(
            req,
            res,
            route.urlParam,
            route.queryParam,
            body,
            route.function,
            route.controllerInstance);
          backError(result, res);
          serveResponse(result, route, res);
          return;
        } else {
          backError(route, res);
        }
      });
    }

    function backError(route: any, res: any): void {
      const error = route.error;
      if (error === 404) {
        res.statusCode = 404;
        res.end('404 Route Not Found');
      } else {
          if (error === 500) {
              res.statusCode = 500;
              res.end('500 Server Internal error.');
          }  else {
            if (typeof error === 'number' ) { // TODO switch
              res.statusCode = error;
              res.end(error + ' ' + route.message);
            }
          }
      }
    }

    function serveStaticFiles(req: any, res: any): void {
      if (req.url === '/') {// default index.html
        req.url = '/index.html';
      }
      const mimeType: string = MimeTypes[req.url.split('.')[1]];
      res.writeHead(200, mimeType);
      const filename = CONFIGURATION.projectDirectory + '/public' + req.url;
      const readStream = fs.createReadStream(filename);
      readStream.on('open', () => {
        readStream.pipe(res);
      });
      readStream.on('error', (err: any) => {
          if (err.code === 'ENOENT') {
              res.statusCode = 404;
              res.end('404 File not found');
          } else {
              res.statusCode = 500;
              res.end('error ', err.Error);
          }
      });
    }

    function serveResponse(result: any, route: any, res: any): void {
    // get le retour et gerer les errors et creer resoponse
    if (result.error) {
      backError(route, res);
    } else {
      if (result.code) {
        res.statusCode = result.code;
      } else {
        res.statusCode = 200;
      }
      if (typeof result === 'string' ) {
        res.setHeader('Content-Type', 'text/plain');
        res.end('' + result);
        return;
      } else {
        if (typeof result === 'object' ) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        } else {
          Console.Warn('return type not found');
          backError({ error: 501, message: 'return type not found' }, res);
        }
      }
    }
    }

    Router.setConfig(CONFIGURATION);
    if (CONFIGURATION.http) {
      this.currentServerHttp = http.createServer(app);
      this.currentServerHttp.listen(CONFIGURATION.httpPort, CONFIGURATION.hostname, () => {
        Console.Info(`Tsunamy server running at http://${CONFIGURATION.hostname}:${CONFIGURATION.httpPort}/`);
      });
    }
    if (CONFIGURATION.https) {
      const privatekey = fs.readFileSync(CONFIGURATION.projectDirectory + '/certificate/key.pem', 'utf-8');
      const certificate = fs.readFileSync(CONFIGURATION.projectDirectory + '/certificate/certificate.pem', 'utf-8');
      this.currentServerHttps = https.createServer({key: privatekey, cert: certificate}, app);
      this.currentServerHttps.listen(CONFIGURATION.httpsPort, CONFIGURATION.hostname, () => {
        Console.Info(`Tsunamy https server running at https://${CONFIGURATION.hostname}:${CONFIGURATION.httpsPort}/`);
      });
    }
    Console.Blue(Console.LogoWithColor());
  }
}
