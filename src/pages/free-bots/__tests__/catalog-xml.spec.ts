import { FREE_BOTS } from '../catalog';

it('offers only the two requested bots with valid loadable workspaces', () => {
    expect(FREE_BOTS.map(bot => bot.title)).toEqual(['Least Digit Decrease Differs', 'Alternating Over/Under']);
    expect(new Set(FREE_BOTS.map(bot => bot.id)).size).toBe(2);
    for (const bot of FREE_BOTS) {
        const document = new DOMParser().parseFromString(bot.xml, 'text/xml');
        expect(document.querySelector('parsererror')).toBeNull();
        expect(document.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(document.querySelector('block[type="before_purchase"]')).not.toBeNull();
    }
});
