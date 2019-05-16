import Apify from "apify";
import {DESCRIPTION_PAGE, OFFERS_PAGE} from "./constants";

export async function testDescriptionPage(requestQueue) {
    const req = new Apify.Request({url: 'https://www.amazon.com/Apple-iPhone-GSM-Unlocked-32GB/dp/B01N9YOF3R/ref=cm_cr_arp_d_product_top?ie=UTF8'});

    req.userData = {
        page: DESCRIPTION_PAGE,
        data: {asin: 'B01N9YOF3R'}
    };
    await requestQueue.addRequest(req)
}
export async function testOffersPage(requestQueue) {
    const req = new Apify.Request({url: 'https://www.amazon.com/gp/offer-listing/B07L77QVKF'});

    req.userData = {
        page: OFFERS_PAGE,
        data: {}
    };
    await requestQueue.addRequest(req)
}