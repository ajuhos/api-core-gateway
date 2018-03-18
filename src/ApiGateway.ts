import { ForwardRule, Target, TargetList, HttpServer, HttpsServer } from "front-door";
import { Api, ApiEdgeDefinition, ExternalApiEdge } from "api-core";
import {ApiGatewayForwardRule} from "./ApiGatewayForwardRule";
import {ApiGatewayAction} from "./ApiGatewayAction";
const request = require('request-promise-native');

export interface ApiGatewayOptions {
    http?: boolean
    https?: boolean
    host?: string
    internalHost?: string
    port?: number
    httpsPort?: number
    retry?: number|(() => boolean)
}

const defaultOptions: ApiGatewayOptions = {
    http: true,
    https: false,
    host: 'localhost',
    internalHost: 'localhost',
    port: 80,
    httpsPort: 443,
    retry: 2000
};

export class ApiGateway {

    private options: ApiGatewayOptions;

    private httpServer: any;
    private httpsServer: any;

    private ruleSet: ApiGatewayForwardRule[];
    private readonly actions: ApiGatewayAction[];

    constructor(options: ApiGatewayOptions) {
        this.options = {
            ...defaultOptions,
            ...options
        };

        this.ruleSet = [];
        this.actions = [];

        if(this.options.http) {
            this.httpServer = new HttpServer(this.ruleSet)
        }

        if(this.options.https) {
            this.httpsServer = new HttpsServer(this.ruleSet)
        }
    }

    action(action: ApiGatewayAction) {
        if(this.actions.indexOf(action) === -1) {
            this.actions.push(action);
            this.ruleSet.forEach(rule => rule.action(action))
        }
        return this
    }

    api = async (uri: string) => {
        const apiInfo = await request({ uri: uri + '/.api-core', json: true });
        const api = Api.fromMetadata(apiInfo);

        const rule = new ApiGatewayForwardRule(
            api, uri,
            `${this.options.internalHost}:${this.options.port}`);
        this.ruleSet.push(rule);
        this.actions.forEach(action => rule.action(action));

        return rule
    };

    listen = (callback: () => void) => {
        let remainingCallbacks = 0;

        const preCallback = () => {
            remainingCallbacks--;
            if(remainingCallbacks === 0) callback()
        };

        if(this.httpServer) {
            remainingCallbacks++;
            this.httpServer.listen(this.options.port, preCallback);
        }

        if(this.httpsServer) {
            remainingCallbacks++;
            this.httpsServer.listen(this.options.httpsPort, preCallback)
        }
    }

}