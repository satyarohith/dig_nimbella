'use strict';

/**
 * Formats 'A' records into slack blocks.
 * @param {array} records - Array returned by the resolve func.
 * @param {string} hostname - The hostname for which the request is made.
 * @returns {array} - An array of formatted slack blocks.
 */
const formatARecords = (records, hostname) => {
  const output = [];
  for (const record of records) {
    output.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${hostname}`
        },
        {
          type: 'mrkdwn',
          text: `Type: *A*`
        },
        {
          type: 'mrkdwn',
          text: `TTL: ${record.ttl}`
        },
        {
          type: 'mrkdwn',
          text: `IP: \`${record.address}\``
        }
      ]
    });
  }

  return output;
};

/**
 * Format 'AAAA' records into slack blocks.
 * @param {array} records - Array returned by the resolve func.
 * @param {string} hostname - The hostname to which the request is made.
 * @returns {array} - An array of formatted slack blocks.
 */
const formatAAAARecords = (records, hostname) => {
  const output = [];
  for (const record of records) {
    output.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${hostname}`
        },
        {
          type: 'mrkdwn',
          text: `Type: *AAAA*`
        },
        {
          type: 'mrkdwn',
          text: `TTL: ${record.ttl}`
        },
        {
          type: 'mrkdwn',
          text: `IP: \`${record.address}\``
        }
      ]
    });
  }

  return output;
};

const formattedMXRecords = (records, hostname) => {
  const output = [];
  for (const record of records) {
    output.push({
      type: 'context',
      elements: [
        {type: 'mrkdwn', text: `${hostname}`},
        {type: 'mrkdwn', text: `\`${record.exchange}\``},
        {type: 'mrkdwn', text: `Priority: \`${record.priority}\``}
      ]
    });
  }

  return output;
};

const formattedTXTRecords = (records, hostname) => {
  const output = [];
  for (const record of records) {
    output.push({
      type: 'context',
      elements: [
        {type: 'mrkdwn', text: `${hostname}`},
        {type: 'mrkdwn', text: `Type: *TXT*`},
        {type: 'mrkdwn', text: `\`${record[0]}\``}
      ]
    });
  }

  return output;
};

const formattedNSRecords = (records, hostname) => {
  const output = [];
  for (const record of records) {
    output.push({
      type: 'context',
      elements: [
        {type: 'mrkdwn', text: `${hostname}`},
        {type: 'mrkdwn', text: `Type: *NS*`},
        {type: 'mrkdwn', text: `\`${record}\``}
      ]
    });
  }

  return output;
};

/**
 * @description null
 * @param {ParamsType} params list of command parameters
 * @param {?string} commandText text message
 * @param {!object} [secrets = {}] list of secrets
 * @return {Promise<SlackBodyType>} Response body
 */
async function _command(params) {
  const {hostname} = params;
  let {type = 'A'} = params;
  type = type.toUpperCase();

  const result = [];
  const dns = require('dns');
  const {promisify} = require('util');

  try {
    switch (type) {
      case 'AAAA': {
        const resolve6Async = promisify(dns.resolve6);
        const records = await resolve6Async(hostname, {ttl: true});
        result.push(...formatAAAARecords(records, hostname));
        break;
      }

      case 'TXT': {
        const resolveTXTAsync = promisify(dns.resolveTxt);
        const records = await resolveTXTAsync(hostname);
        result.push(formattedTXTRecords(records));
        break;
      }

      case 'MX': {
        const resolveMXAsync = promisify(dns.resolveMx);
        const records = await resolveMXAsync(hostname);
        result.push(...formattedMXRecords(records, hostname));
        break;
      }

      case 'NS': {
        const resolveNSAsync = promisify(dns.resolveNs);
        const records = await resolveNSAsync(hostname);
        result.push(...formattedNSRecords(records, hostname));
        break;
      }

      // The default record is 'A'
      default: {
        const resolve4Async = promisify(dns.resolve4);
        const records = await resolve4Async(hostname, {ttl: true});
        result.push(...formatARecords(records, hostname));
        break;
      }
    }
  } catch (error) {
    if (error.code === 'ENODATA') {
      result.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `No records of type *${type}* found for ${hostname}.`
          }
        ]
      });
    } else if (error.code === 'ENOTFOUND') {
      result.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Domain ${hostname} not found.`
          }
        ]
      });
    } else {
      result.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*ERROR:* ${error.message}`
        }
      });
    }
  }

  return {
    response_type: 'in_channel', // eslint-disable-line camelcase
    blocks: result
  };
}

/**
 * @typedef {object} SlackBodyType
 * @property {string} text
 * @property {'in_channel'|'ephemeral'} [response_type]
 */

const main = async ({__secrets = {}, commandText, ...params}) => ({
  body: await _command(params, commandText, __secrets)
});
module.exports = main;
