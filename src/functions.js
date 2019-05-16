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
                const asyn = $(item)
                    .attr('data-asin');
                const url = AMAZON_BASE_URL +
                    $(item)
                        .find('span[data-component-type="s-product-image"] > a[href]')
                        .attr('href');
                const isService = $(item)
                    .find('span.a-price-whole') === undefined;
                data.push(
                    {
                        asyn,
                        url,
                        isService
                    }
                );
            });

        return data;
    };
    const items = await getSearchItemsFunction();
    log.debug(prettyjson.render(items));
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


    const req = new Apify.Request({url: `${AMAZON_BASE_URL}/gp/offer-listing/${request.userData.data.asyn}`});

    let passedData = {...request.userData.data, ...data};
    req.userData = {
        page: OFFERS_PAGE,
        data: passedData
    };
    const queueOperationInfo = await requestQueue.addRequest(req);

    return {data: passedData, queueOperationInfo};
}

export async function offersPageFunction(request, requestQueue, $) {

    const getPagesFunction = () => {
        let pages = [];
        const $offersPages = $('#olpOfferListColumn > * > ul.a-pagination > li');

        if (!$offersPages)
            return pages;

        let $offersPagesArr = Array.from(
            $offersPages
        );

        // remove first (Previous) and last (Next) elements
        $offersPagesArr = $offersPagesArr.slice(1, $offersPagesArr.length - 1);

        pages = $offersPagesArr.map((li) => {

            const urlPath = $('a', $(li)).attr('href');

            return {url: `${AMAZON_BASE_URL}${urlPath}`};
        });

        return pages;
    };
    const getOffersFunction = () => {
        let offers = [];

        $('div.olpOffer', $('#olpOfferListColumn'))
            .each((index, olpOffer) => {
                const $olpOffer = $(olpOffer);
                const shipping = $('.olpShippingInfo * b', $olpOffer).text().trim();
                offers.push({
                    sellerName: $('.olpSellerName', $olpOffer).text().trim(),
                    offer: $('.olpOfferPrice', $olpOffer).text().trim(),
                    shipping: shipping.includes("FREE Shipping") ? "free" : shipping
                })
            });
        return offers;
    };
    let data, queueOperationInfo;
    const nextPages = request.userData.nextPages;
    if (!nextPages) {
        const pages = await getPagesFunction();

        const firstPageOffers = await getOffersFunction();
        if (pages.length === 0) {
            data = {...request.userData.data, offers: firstPageOffers}
        } else {
            pages.shift();
            const req = new Apify.Request({url: pages[0].url});
            req.userData = {
                page: OFFERS_PAGE,
                data: {...request.userData.data, offers: firstPageOffers},
                nextPages: pages
            };
            queueOperationInfo = await requestQueue.addRequest(req)
        }


    } else {
        // all offers extracted, now set the data and return it later
        if (nextPages.length === 0) {
            data = request.userData.data
        } else {
            const pages = nextPages;
            const offers = await getOffersFunction();

            pages.shift();

            const req = new Apify.Request({url: pages[0].url});

            req.userData = {
                page: OFFERS_PAGE,
                data: {
                    ...request.userData.data,
                    offers: {
                        ...request.userData.offers,
                        ...offers
                    }
                },
                nextPages: pages
            };
            queueOperationInfo = await requestQueue.addRequest(req)
        }
    }

    return {data, queueOperationInfo};
}
