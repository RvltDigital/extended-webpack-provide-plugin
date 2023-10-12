const BaseProvidedDependency = require('webpack/lib/dependencies/ProvidedDependency');


class ProvidedDependency extends BaseProvidedDependency
{
    constructor(request, identifier, ids, range, location)
    {
        super(request, identifier, ids, range);
        this.loc = location;
    }
}

module.exports = ProvidedDependency;
