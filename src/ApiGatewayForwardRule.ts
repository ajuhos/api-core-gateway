import { Api, ApiEdgeError } from 'api-core';
import { OutgoingMessage, IncomingMessage } from 'http';
import { Socket } from 'net';
import { ForwardRule, TargetList, Target, Credentials } from "front-door";
import {ApiGatewayAction, ApiGatewayScope} from "./ApiGatewayAction";

const forward      = require('front-door/lib/handlers/forward');
const sendError    = require('front-door/lib/handlers/send-error');
const authenticate = require('front-door/lib/handlers/authenticate');

const url = require('url');

const target = (href: string) => {
    const list = new TargetList();
    new Target(list, 1, href + '/{0}{1}');
    return list
};

const routing = (host: string, routes: string[]) => new RegExp(`${host}\\/(${routes.join('|')})(.*)`);

export class ApiGatewayForwardRule extends ForwardRule {

    constructor(api: Api, targetHost: string, internalHost: string, credentials?: Credentials) {
        super(
            routing(internalHost, api.edges.map(edge => edge.pluralName)),
            target(targetHost),
            credentials
        );

        console.log(`${this.regexp} --> ${targetHost}/{0}{1}`);

        this.api = api
    }

    readonly api: Api;
    private readonly actions: ApiGatewayAction[] = [];

    action(action: ApiGatewayAction) {
        if(this.actions.indexOf(action) === -1) {
            this.actions.push(action)
        }
        return this
    }

    private async verifyRoute(req: OutgoingMessage, res: IncomingMessage, href: string) {
        const parsedUrl = url.parse(href, true);
        const route = parsedUrl.pathname.split('/').filter((a: string) => a);

        try {
            const request = this.api.parseRequest(route);

            if (!request.path.segments.length) {
                sendError(req, res, 404, 'Not Found');
                return false
            }

            let scope = new ApiGatewayScope(request, parsedUrl,{ role: 'guest' });
            for(let action of this.actions) {
                scope = await action.execute(scope)
            }
        }
        catch(e) {
            if(e instanceof ApiEdgeError) {
                sendError(req, res, e.status, e.message)
            }
            else {
                console.error(e);
                sendError(req, res, 500, 'Internal Server Error')
            }

            return false
        }

        return true
    }

    async tryHandle(req: OutgoingMessage, res: IncomingMessage, href: string): Promise<boolean> {
        const args = super.match(href);

        if (!args)
            return false;

        if(!(await this.verifyRoute(req, res, href)))
            return true;

        const target = this.targets.pick(req);

        if (!target) {
            sendError(req, res, 503, 'The proxy server is unable to connect to an upstream server');
            return true
        }

        if (this.credentials) {
            const { realm, user, pass } = this.credentials;

            authenticate(req, res, realm, user, pass, () => forward(req, res, target, args))
        }
        else
            forward(req, res, target, args);

        return true
    }

    async tryHandleWebSocket(req: OutgoingMessage, socket: Socket, head: string, href: string): Promise<boolean> {
        throw new Error('WebSockets are not supported by API Core.')
    }

}