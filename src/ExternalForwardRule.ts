import { OutgoingMessage, IncomingMessage } from 'http';
import { Socket } from 'net';
import {ApiGatewayAction} from "./ApiGatewayAction";

const Rule = require('front-door/lib/rules/rule');

export class ExternalForwardRule extends Rule {

    private readonly handler: (req: OutgoingMessage, res: IncomingMessage) => void;

    constructor(handler: (req: OutgoingMessage, res: IncomingMessage) => void) {
        super(/.*/);
        this.handler = handler
    }

    action(action: ApiGatewayAction) {
        return this
    }

    async tryHandle(req: OutgoingMessage, res: IncomingMessage, href: string): Promise<boolean> {
        this.handler(req, res);
        return true
    }

    async tryHandleWebSocket(req: OutgoingMessage, socket: Socket, head: string, href: string): Promise<boolean> {
        throw new Error('WebSockets are not supported by API Core.')
    }

}