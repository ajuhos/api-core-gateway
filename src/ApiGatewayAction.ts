import { ApiRequest } from 'api-core'
import { Url } from 'url';

export interface ApiGatewayIdentity {
    role: string;
    account?: any;
}

export class ApiGatewayScope {
    constructor(request: ApiRequest, url: Url, identity: ApiGatewayIdentity) {
        this.request = request;
        this.url = url;
        this.identity = identity
    }

    url: Url;
    request: ApiRequest;
    identity: ApiGatewayIdentity;
}

export interface ApiGatewayAction {
    execute(scope: ApiGatewayScope): Promise<ApiGatewayScope>
}