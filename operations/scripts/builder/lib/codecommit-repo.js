'use strict';

const aws = require('aws-sdk');
const codecommit = new aws.CodeCommit({ apiVersion: '2015-04-13' });

class CodeCommitRepo
{
    constructor(repositories = []) {
        this.repositories = repositories;
    }


    _getRepositories () {
        if ((!this.repositories) || (!this.repositories.length < 1)) {
            return [];
        }

        return this.repositories;
    }

    static _getDifferencesFrom (repo, branch) {

    }

    static _getBlobsFrom () {

    }
}