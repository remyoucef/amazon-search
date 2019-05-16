import {DESCRIPTION_PAGE, OFFERS_PAGE} from "./constants";
import {descriptionPageFunction, offersPageFunction, searchPageFunction} from "./functions";

import Apify from "apify";
const { log } = Apify.utils;


let searchPageResult
Apify.main(async () => {
    const input = await Apify.getInput();
    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({url: `https://www.amazon.com/s?k=${input.keyword}&ref=nb_sb_noss`});

    // Create an instance of the PuppeteerCrawler class - a crawler
    // that automatically loads the URLs in headless Chrome / Puppeteer.
    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        minConcurrency: 10,
        maxConcurrency: 50,
        // launchPuppeteerOptions: {slowMo: 500},
        maxRequestRetries: 1,
        // Stop crawling after several pages
        // maxRequestsPerCrawl: 10,

        handlePageFunction: async ({ request, html, $ }) => {
            log.debug(`Processing ${request.url}...`);
            if (!request.userData.page) {
                searchPageResult = await searchPageFunction(request, requestQueue, $);
            } else {
                switch (request.userData.page) {
                    case DESCRIPTION_PAGE: {
                        const result = await descriptionPageFunction(request, requestQueue, $);

                        break
                    }
                    case OFFERS_PAGE: {
                        const result = await offersPageFunction(request, requestQueue, $);
                        if (result.data){
                            const data = {
                                title: result.data.title,
                                itemUrl: result.data.url,
                                description: result.data.description,
                                keyword: input.keyword,
                                offers: result.data.offers
                            }
                            await Apify.pushData(data)
                        }
                        break
                    }
                    default:

                }
            }

        },

        // This function is called if the page processing failed more than maxRequestRetries+1 times.
        handleFailedRequestFunction: async ({request}) => {
            log.error(`Request ${request.url} failed too many times`);
            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
    });

    // Run the crawler and wait for it to finish.
    await crawler.run();

    log.debug('Crawler finished.');
});
