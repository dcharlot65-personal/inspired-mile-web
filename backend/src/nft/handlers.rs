use axum::{
    extract::Path,
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use sqlx::PgPool;

use crate::config::Config;

/// NFT metadata following the Metaplex Token Metadata standard.
#[derive(Serialize)]
pub struct NftMetadata {
    name: String,
    symbol: String,
    description: String,
    image: String,
    external_url: String,
    attributes: Vec<NftAttribute>,
    properties: NftProperties,
}

#[derive(Serialize)]
pub struct NftAttribute {
    trait_type: String,
    value: serde_json::Value,
}

#[derive(Serialize)]
pub struct NftProperties {
    category: String,
    files: Vec<NftFile>,
}

#[derive(Serialize)]
pub struct NftFile {
    uri: String,
    #[serde(rename = "type")]
    file_type: String,
}

/// Card data — hardcoded catalog matching the frontend cards.ts
struct CardInfo {
    id: &'static str,
    name: &'static str,
    house: &'static str,
    card_type: &'static str,
    rarity: &'static str,
    element: &'static str,
    atk: i32,
    def: i32,
    hp: i32,
    quote: &'static str,
}

const CARDS: &[CardInfo] = &[
    CardInfo { id: "SM-001", name: "The Sonnet Man", house: "Legendary", card_type: "Character", rarity: "Legendary", element: "Fire", atk: 95, def: 80, hp: 100, quote: "Shall I compare thee to a summer's day?" },
    CardInfo { id: "MO-001", name: "Romeo", house: "Montague", card_type: "Character", rarity: "Rare", element: "Passion", atk: 75, def: 60, hp: 85, quote: "But soft, what light through yonder window breaks?" },
    CardInfo { id: "CA-001", name: "Juliet", house: "Capulet", card_type: "Character", rarity: "Rare", element: "Grace", atk: 70, def: 75, hp: 90, quote: "What's in a name? That which we call a rose..." },
    CardInfo { id: "DC-001", name: "Hamlet", house: "Danish Court", card_type: "Character", rarity: "Epic", element: "Shadow", atk: 85, def: 70, hp: 95, quote: "To be, or not to be, that is the question." },
    CardInfo { id: "DC-002", name: "Ophelia", house: "Danish Court", card_type: "Character", rarity: "Rare", element: "Water", atk: 55, def: 85, hp: 80, quote: "There's rosemary, that's for remembrance." },
    CardInfo { id: "MO-002", name: "Mercutio", house: "Montague", card_type: "Character", rarity: "Rare", element: "Wind", atk: 80, def: 55, hp: 75, quote: "A plague on both your houses!" },
    CardInfo { id: "FA-001", name: "Puck", house: "Forest of Arden", card_type: "Character", rarity: "Uncommon", element: "Trickster", atk: 65, def: 65, hp: 70, quote: "Lord, what fools these mortals be!" },
    CardInfo { id: "FA-002", name: "Titania", house: "Forest of Arden", card_type: "Character", rarity: "Epic", element: "Nature", atk: 60, def: 90, hp: 85, quote: "Come, sit thee down upon this flowery bed." },
    CardInfo { id: "RL-001", name: "Yorick's Skull", house: "Relic", card_type: "Relic", rarity: "Rare", element: "Death", atk: 0, def: 0, hp: 0, quote: "Alas, poor Yorick! I knew him, Horatio." },
    CardInfo { id: "RL-002", name: "Prospero's Staff", house: "Relic", card_type: "Relic", rarity: "Legendary", element: "Arcane", atk: 0, def: 0, hp: 0, quote: "Now my charms are all o'erthrown." },
    CardInfo { id: "PT-001", name: "Love Potion", house: "Potion", card_type: "Potion", rarity: "Common", element: "Enchantment", atk: 0, def: 0, hp: 0, quote: "The course of true love never did run smooth." },
    CardInfo { id: "PT-002", name: "Witches' Brew", house: "Potion", card_type: "Potion", rarity: "Uncommon", element: "Dark", atk: 0, def: 0, hp: 0, quote: "Double, double toil and trouble." },
    CardInfo { id: "VC-001", name: "Prince Escalus", house: "Verona Court", card_type: "Character", rarity: "Epic", element: "Justice", atk: 70, def: 85, hp: 95, quote: "If ever you disturb our streets again, your lives shall pay the forfeit of the peace." },
    CardInfo { id: "VC-002", name: "Friar Lawrence", house: "Verona Court", card_type: "Character", rarity: "Uncommon", element: "Earth", atk: 35, def: 80, hp: 90, quote: "These violent delights have violent ends." },
    CardInfo { id: "VC-003", name: "The Nurse", house: "Verona Court", card_type: "Character", rarity: "Common", element: "Loyalty", atk: 30, def: 70, hp: 85, quote: "I am the drudge and toil in your delight." },
    CardInfo { id: "TP-001", name: "Prospero", house: "The Tempest", card_type: "Character", rarity: "Epic", element: "Storm", atk: 90, def: 85, hp: 90, quote: "We are such stuff as dreams are made on." },
    CardInfo { id: "TP-002", name: "Ariel", house: "The Tempest", card_type: "Character", rarity: "Rare", element: "Air", atk: 70, def: 75, hp: 65, quote: "All hail, great master! Grave sir, hail!" },
    CardInfo { id: "TP-003", name: "Caliban", house: "The Tempest", card_type: "Character", rarity: "Uncommon", element: "Beast", atk: 75, def: 45, hp: 80, quote: "This island's mine, by Sycorax my mother." },
    CardInfo { id: "MO-003", name: "Benvolio", house: "Montague", card_type: "Character", rarity: "Common", element: "Peace", atk: 55, def: 70, hp: 75, quote: "I do but keep the peace. Put up thy sword." },
    CardInfo { id: "CA-002", name: "Tybalt", house: "Capulet", card_type: "Character", rarity: "Rare", element: "Fire", atk: 88, def: 50, hp: 70, quote: "What, drawn, and talk of peace? I hate the word." },
    CardInfo { id: "DC-003", name: "King Claudius", house: "Danish Court", card_type: "Character", rarity: "Rare", element: "Poison", atk: 80, def: 60, hp: 85, quote: "My words fly up, my thoughts remain below." },
    CardInfo { id: "FA-003", name: "Oberon", house: "Forest of Arden", card_type: "Character", rarity: "Epic", element: "Moonlight", atk: 75, def: 80, hp: 85, quote: "Ill met by moonlight, proud Titania." },
    CardInfo { id: "RL-003", name: "Dagger of the Mind", house: "Relic", card_type: "Relic", rarity: "Uncommon", element: "Illusion", atk: 0, def: 0, hp: 0, quote: "Is this a dagger which I see before me?" },
    CardInfo { id: "PT-003", name: "Puck's Flower Juice", house: "Potion", card_type: "Potion", rarity: "Common", element: "Mischief", atk: 0, def: 0, hp: 0, quote: "I'll put a girdle round about the earth in forty minutes." },
];

fn find_card(card_id: &str) -> Option<&'static CardInfo> {
    CARDS.iter().find(|c| c.id.eq_ignore_ascii_case(card_id))
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new().route("/metadata/{card_id}", get(get_metadata))
}

/// GET /nft/metadata/:card_id — Public endpoint returning Metaplex-compatible NFT metadata JSON.
async fn get_metadata(
    Path(card_id): Path<String>,
) -> Result<Json<NftMetadata>, (StatusCode, String)> {
    let card = find_card(&card_id)
        .ok_or((StatusCode::NOT_FOUND, format!("Card not found: {card_id}")))?;

    let image_url = format!(
        "https://sonnetman.inspiredmile.com/images/cards/{}.webp",
        card.id.to_lowercase()
    );

    let mut attributes = vec![
        NftAttribute { trait_type: "House".into(), value: card.house.into() },
        NftAttribute { trait_type: "Type".into(), value: card.card_type.into() },
        NftAttribute { trait_type: "Rarity".into(), value: card.rarity.into() },
        NftAttribute { trait_type: "Element".into(), value: card.element.into() },
    ];

    if card.card_type == "Character" {
        attributes.push(NftAttribute { trait_type: "ATK".into(), value: card.atk.into() });
        attributes.push(NftAttribute { trait_type: "DEF".into(), value: card.def.into() });
        attributes.push(NftAttribute { trait_type: "HP".into(), value: card.hp.into() });
    }

    Ok(Json(NftMetadata {
        name: format!("Inspired Mile: {}", card.name),
        symbol: "MILE".into(),
        description: format!("{} — {}", card.name, card.quote),
        image: image_url.clone(),
        external_url: "https://sonnetman.inspiredmile.com".into(),
        attributes,
        properties: NftProperties {
            category: "image".into(),
            files: vec![NftFile {
                uri: image_url,
                file_type: "image/webp".into(),
            }],
        },
    }))
}
