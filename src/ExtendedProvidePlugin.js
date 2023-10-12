const ConstDependency = require('webpack/lib/dependencies/ConstDependency');
const ProvidedDependency = require('./ProvidedDependency');
const { PLUGIN_NAME, MODULE_TYPE, ENV } = require('./constants');
const { loadDefinitions, moduleParserHandler } = require('./helpers');


class ExtendedProvidePlugin
{
    constructor({ path, override = {} })
    {
        const definitions = loadDefinitions(path);
        Object.assign(definitions[ENV.DEV], override);
        Object.assign(definitions[ENV.PROD], override);

        this.definitions = definitions;
    }

    apply(compiler)
    {
      	compiler.hooks.compilation.tap(
            PLUGIN_NAME,
            (compilation, { normalModuleFactory }) => {
                compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());
                compilation.dependencyFactories.set(ProvidedDependency, normalModuleFactory);
                compilation.dependencyTemplates.set(ProvidedDependency, new ProvidedDependency.Template());

                const handler = moduleParserHandler.bind(null, this.definitions[compiler.options.mode === ENV.DEV? ENV.DEV: ENV.PROD]);
                MODULE_TYPE.forEach(
                    (type) => normalModuleFactory.hooks.parser
                      .for(type)
                      .tap(PLUGIN_NAME, handler)
                );
            }
        );
   }
}

module.exports = ExtendedProvidePlugin;
