import Apify from "apify";

const {log} = Apify.utils;
import * as prettyjson from "prettyjson";
import {DESCRIPTION_PAGE, OFFERS_PAGE} from "./constants";

const AMAZON_BASE_URL = `https://www.amazon.com`;

export async function searchPageFunction(request, requestQueue, $) {
    const getSearchItemsFunction = () => {
        const data = [];

        $('[data-asin]', '[data-component-type="s-search-results"]')
            .each((index, item) => {
                const asin = $(item)
                    .attr('data-asin');
                const url = AMAZON_BASE_URL +
                    $('span[data-component-type="s-product-image"] > a[href]', $(item))
                        .attr('href');
                const isService = $('span.a-price-whole', $(item)) === undefined;
                data.push(
                    {
                        asin: asin,
                        url,
                        isService
                    }
                );
            });

        return data;
    };
    const items = await getSearchItemsFunction();
    // log.debug(prettyjson.render(items));
    const queueOperationInfos = [];
    for (const d of items) {
        if (!d.isService) {
            const req = new Apify.Request({url: d.url});

            req.userData = {
                page: DESCRIPTION_PAGE,
                data: d
            };
            queueOperationInfos.push(await requestQueue.addRequest(req))
        }

    }
    return {data: items, queueOperationInfos};
}

export async function descriptionPageFunction(request, requestQueue, $) {
    const getDescriptionFunction = () => {
        let $title = $('#productTitle');
        let $description = $('#productDescription > p');
        return {
            title: $title ? $title.text().trim() : "",
            description: $description ? $description.text().trim() : ""
        };
    };
    const data = await getDescriptionFunction();


    const req = new Apify.Request({url: `${AMAZON_BASE_URL}/gp/offer-listing/${request.userData.data.asin}`});

    let passedData = {...request.userData.data, ...data};
    req.userData = {
        page: OFFERS_PAGE,
        data: passedData
    };
    const queueOperationInfo = await requestQueue.addRequest(req);

    return {data: passedData, queueOperationInfo};
}

function getStringify(object) {
    var cache = [];
    const result = JSON.stringify(object, function (key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Duplicate reference found
                try {
                    // If this value does not reference a parent it can be deduped
                    return JSON.parse(JSON.stringify(value));
                } catch (error) {
                    // discard key if value cannot be deduped
                    return;
                }
            }
            // Store value in our collection
            cache.push(value);
        }
        return value;
    });
    cache = null;
    return result
}

export async function offersPageFunction(request, requestQueue, $) {

    const getPagesFunction = () => {
        let pages = [];
        const $offersPages = $('#olpOfferListColumn > * > ul.a-pagination > li');


        if ($offersPages.get().length === 0)
            return pages;

        // remove first (Previous) and last (Next) elements,
        // then extract all pages urls
        $offersPages
            .slice(1, $offersPages.length - 1)
            .each((index, li) => {
                const urlPath = $('a', $(li)).attr('href');
                if (urlPath !== '#')
                    pages.push({url: `${AMAZON_BASE_URL}${urlPath}`});
            })

        return pages;
    };
    const getOffersFunction = () => {
        let offers = [];

        function getShipping($olpOffer) {
            return $('.olpShippingInfo', $olpOffer).text().includes("FREE Shipping")
                ? "free"
                : $('.olpShippingPrice', $olpOffer).text().trim();
        }

        function getSellerName($olpOffer) {
            const text = $('.olpSellerName', $olpOffer).text().trim();
            return text !== "" ? text : $('.olpSellerName img', $olpOffer).attr('alt');
        }

        $('div.olpOffer', $('#olpOfferListColumn'))
            .each((index, olpOffer) => {
                const $olpOffer = $(olpOffer);

                offers.push({
                    sellerName: getSellerName($olpOffer),
                    offer: $('.olpOfferPrice', $olpOffer).text().trim(),
                    shipping: getShipping($olpOffer)
                })
            });
        return offers;
    };
    let data, queueOperationInfo;
    const nextPages = request.userData.nextPages;
    // !nextPages || log.debug(prettyjson.render(nextPages))
    if (!nextPages) {
        const pages = await getPagesFunction();
        const offers = await getOffersFunction();
        if (pages.length === 0) {
            data = {...request.userData.data, offers: offers}
        } else {
            const req = new Apify.Request({url: pages[0].url});
            // remove next page because it's added to the request
            pages.shift()
            req.userData = {
                page: OFFERS_PAGE,
                data: {...request.userData.data, offers: offers},
                nextPages: pages
            };
            queueOperationInfo = await requestQueue.addRequest(req)
        }
    } else {
        const offers = await getOffersFunction();
        const mergedData = {
            ...request.userData.data,
            offers: [
                ...request.userData.data.offers,
                ...offers
            ]
        };
        // we are on the last page
        if (nextPages.length === 0) {
            data = mergedData;
        } else {

            const pages = nextPages;
            const req = new Apify.Request({url: pages[0].url});
            pages.shift();

            req.userData = {
                page: OFFERS_PAGE,
                data: mergedData,
                nextPages: pages
            };
            queueOperationInfo = await requestQueue.addRequest(req)
        }
    }

    return {data, queueOperationInfo};
}
