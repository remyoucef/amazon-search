import {DESCRIPTION_PAGE, OFFERS_PAGE} from "./constants";
import {descriptionPageFunction, offersPageFunction, searchPageFunction} from "./functions";
import Apify from "apify";
import {testDescriptionPage, testOffersPage} from "./main.test";
import * as prettyjson from "prettyjson";

const {log} = Apify.utils;


async function handlePageFunction(requestQueue, keyword, request, html, $) {

    // log.debug(`Processing ${request.url}...`);
    if (!request.userData.page) {
        await searchPageFunction(request, requestQueue, $);
    } else {
        switch (request.userData.page) {
            case DESCRIPTION_PAGE: {
                await descriptionPageFunction(request, requestQueue, $);
                break
            }
            case OFFERS_PAGE: {
                const result = await offersPageFunction(request, requestQueue, $);

                if (result.data) {
                    const data = {
                        title: result.data.title,
                        itemUrl: result.data.url,
                        description: result.data.description,
                        keyword: keyword,
                        offers: result.data.offers
                    }
                    await Apify.pushData(data)
                }
                break
            }
            default:

        }
    }


}

async function handleFailedRequestFunction({request}) {
    // log.error(`Request ${request.url} failed too many times`);
    await Apify.pushData({
        '#debug': Apify.utils.createRequestDebugInfo(request),
    });
}

Apify.main(async () => {
    const input = await Apify.getInput();
    const requestQueue = await Apify.openRequestQueue();
    const keyword = input.keyword.replace(new RegExp(' ', 'g'), '+');
    await requestQueue.addRequest({url: `https://www.amazon.com/s?k=${keyword}&ref=nb_sb_noss`});
    // await testDescriptionPage(requestQueue);
    // await testOffersPage(requestQueue);

    // Create an instance of the PuppeteerCrawler class - a crawler
    // that automatically loads the URLs in headless Chrome / Puppeteer.
    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        minConcurrency: 10,
        maxConcurrency: 50,
        // launchPuppeteerOptions: {slowMo: 500},
        maxRequestRetries: 3,
        handlePageTimeoutSecs: 540,
        // Stop crawling after several pages
        // maxRequestsPerCrawl: 10,

        handlePageFunction: ({request, html, $}) => handlePageFunction(requestQueue, keyword, request, html, $),

        // This function is called if the page processing failed more than maxRequestRetries+1 times.
        handleFailedRequestFunction: handleFailedRequestFunction,
    });

    // Run the crawler and wait for it to finish.
    await crawler.run();

    log.debug('Crawler finished.');
});
