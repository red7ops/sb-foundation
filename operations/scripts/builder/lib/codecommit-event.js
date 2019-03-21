'use strict';

class CodeCommitEvent
{
    constructor (event = {}) {
        this.event = event;
    }

    getBranches () {
        return this._getRecords().reduce((branchNames, record) => {
            let recordBranches = this._getReferencesFrom(record)
                .map((reference) => this._getBranchNameFrom(reference));
            return branchNames.concat(recordBranches);
        }, []);
    }

    getRepositories () {
        return this._getRecords().reduce((repoName, record) => {
            let source = this._getSourceFrom (record);
            return source.split(":")[5];
        }, []);
    }

    _getRecords () {
        if ((!this.event) || (!this.event.Records)) {
            return [];
        }

        return this.event.Records;
    }

    static _getReferencesFrom (record) {
        return (record.codecommit && record.codecommit.references) ? record.codecommit.references : [];
    }

    static _getBranchNameFrom (reference) {
        let referencePrefix = 'refs/heads/';
        return reference.ref.substr(referencePrefix.length);
    }

    static _getSourceFrom (record) {
        return (record.eventSourceARN) ? record.eventSourceARN : "";
    }
}

module.exports = CodeCommitEvent;