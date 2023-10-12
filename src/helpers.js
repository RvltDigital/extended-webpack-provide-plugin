const { parse, resolve } = require('path');
const { statSync, readdirSync } = require('fs');
const snakeCase = require('lodash.snakecase');
const ProvidedDependency = require('./ProvidedDependency');
const { PLUGIN_NAME, ENV, POSTFIX } = require('./constants');


const ENV_SHARED = 'shared';

function loadDefinitions(path)
{
    const definitions = { [ENV.DEV]: {}, [ENV.PROD]: {} };
    if (typeof path !== 'string' || !statSync(path).isDirectory()) {
        return definitions;
    }

    definitions[ENV_SHARED] = {};
    for (const fileName of readdirSync(path)) {
        let { name, ext } = parse(fileName);

        let mode = ENV_SHARED;
        if (name.endsWith(POSTFIX.DEV)) {
            name = name.slice(0, -POSTFIX.DEV.length);
            mode = ENV.DEV;
        } else if (name.endsWith(POSTFIX.PROD)) {
            name = name.slice(0, -POSTFIX.PROD.length);
            mode = ENV.PROD;
        }

        switch (ext) {
            case '.js':
                if (name.endsWith(POSTFIX.FN)) {
                    const key = name.slice(0, -POSTFIX.FN.length);
                    setDefinition(definitions, key, resolve(path, fileName), mode);
                    break;
                }
                if (name.endsWith(POSTFIX.STATIC)) {
                    name = name.slice(0, -POSTFIX.STATIC.length)
                } else {
                    setDefinition(definitions, toDefinitionKey(name), resolve(path, fileName), mode);
                    break;
                }
            case '.json':
                Object.keys(require(resolve(path, fileName)))
                    .forEach((key) => setDefinition(definitions, toDefinitionKey(key), [ resolve(path, fileName), key ], mode));
                break;
            default:
                throw new Error(`Invalid "${ext}" extension.`);
        }
    }

    return {
        [ENV.DEV]: Object.assign({}, definitions[ENV_SHARED], definitions[ENV.DEV]),
        [ENV.PROD]: Object.assign({}, definitions[ENV_SHARED], definitions[ENV.PROD])
    };
}

function toDefinitionKey(name)
{
    return name.split('.').map(snakeCase).join('.').toUpperCase();
}

function setDefinition(definitions, key, value, mode)
{
    if (definitions[mode][key] !== undefined) {
        throw new Error(`A constant named "${key}" already exists for ${mode} mode.`);
    }
    definitions[mode][key] = value;
}

function moduleParserHandler(definitions, parser)
{
    Object.keys(definitions).forEach((name) => {
        registerRename(parser, name);
        registerExpression(parser, name, definitions[name]);
        registerCall(parser, name, definitions[name]);
    });
}

function registerRename(parser, name)
{
    const splitted = name.split('.');
    if (splitted.length > 1) {
        for (let i = 0; i < splitted.length - 1; i++) {
            parser.hooks.canRename
              .for(splitted.slice(0, i + 1).join('.')).tap(PLUGIN_NAME, () => true);
        }
    }
}

function registerExpression(parser, name, definition)
{
    const request = [].concat(definition);
    parser.hooks.expression.for(name).tap(PLUGIN_NAME, (expression) => {
        parser.state.module.addDependency(new ProvidedDependency(
            request[0],
            toIdentifier(name),
            request.slice(1),
            expression.range,
            expression.loc
        ));
        return true;
    });
}

function registerCall(parser, name, definition)
{
    const request = [].concat(definition);
    parser.hooks.call.for(name).tap(PLUGIN_NAME, (expression) => {
        parser.state.module.addDependency(new ProvidedDependency(
            request[0],
            toIdentifier(name),
            request.slice(1),
            expression.callee.range,
            expression.callee.loc
        ));
        parser.walkExpressions(expression.arguments);
        return true;
    });
}

function toIdentifier(name)
{
    return name.includes('.')? '__webpack_provided_' + name.replaceAll('.', '_dot_'): name;
}

module.exports = { loadDefinitions, moduleParserHandler };
