'use strict';

const npm = require('npm');

const CodeCommitSDK = require('./lib/codecommit-sdk');
const CodeCommitEvent = require('./lib/codecommit-event');

/**
 * Main
 * @param {SnsEvent} event
 * @param {Object} context
 * @param {HandlerCallback} callback
 */
exports.handler = function(event, context, callback) {

    console.log(JSON.stringify(event, null, 2));

    let sdk = new CodeCommitSDK();
    let ccEvent = new CodeCommitEvent(event);
    let repos = ccEvent.getRepositories();

    let params = {
        afterCommitSpecifier: "",
        repositoryName: ""
    }
    // TODO check if aws branch exists?




};