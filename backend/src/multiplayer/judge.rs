use serde::{Deserialize, Serialize};

use crate::config::Config;

/// LLM judge result for a battle round.
#[derive(Debug, Serialize, Deserialize)]
pub struct JudgeResult {
    pub player1_score: AxisScore,
    pub player2_score: AxisScore,
    pub player1_wins: bool,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AxisScore {
    pub wordplay: i32,
    pub shakespeare: i32,
    pub flow: i32,
    pub wit: i32,
    pub total: i32,
}

const JUDGE_PROMPT: &str = r#"You are a judge for a Shakespearean rap battle. Score each contestant on 4 axes (1-10 each):
- wordplay: clever use of words, puns, double meanings
- shakespeare: authentic Shakespearean language and references
- flow: rhythm, meter, delivery quality
- wit: humor, cleverness, comebacks

Respond ONLY with valid JSON matching this exact format (no markdown, no explanation):
{"player1_score":{"wordplay":7,"shakespeare":6,"flow":8,"wit":7,"total":28},"player2_score":{"wordplay":6,"shakespeare":8,"flow":7,"wit":6,"total":27},"player1_wins":true,"reason":"Player 1 had superior flow and wordplay"}"#;

/// Judge a battle round using the Anthropic API.
pub async fn judge_battle(
    player1_text: &str,
    player2_text: &str,
    config: &Config,
) -> Result<JudgeResult, String> {
    let api_key = config.llm_api_key.as_ref()
        .ok_or("LLM_API_KEY not configured")?;

    let prompt = format!(
        "{}\n\nPlayer 1's verse:\n{}\n\nPlayer 2's verse:\n{}",
        JUDGE_PROMPT, player1_text, player2_text
    );

    let body = serde_json::json!({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 256,
        "messages": [{
            "role": "user",
            "content": prompt
        }]
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Client build error: {e}"))?;

    let response = match tokio::time::timeout(
        std::time::Duration::from_secs(15),
        client
            .post(&config.llm_api_url)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send(),
    )
    .await
    {
        Ok(result) => result.map_err(|e| format!("HTTP error: {e}"))?,
        Err(_) => return Ok(judge_fallback()),
    };

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error {status}: {text}"));
    }

    let resp: serde_json::Value = response.json().await
        .map_err(|e| format!("JSON parse error: {e}"))?;

    let content = resp["content"][0]["text"].as_str()
        .ok_or("Missing content in response")?;

    let result: JudgeResult = serde_json::from_str(content)
        .map_err(|e| format!("Judge response parse error: {e}"))?;

    Ok(result)
}

/// Fallback random judge when LLM is not available.
pub fn judge_fallback() -> JudgeResult {
    use rand::Rng;
    let mut rng = rand::thread_rng();

    let p1 = AxisScore {
        wordplay: rng.gen_range(4..=9),
        shakespeare: rng.gen_range(4..=9),
        flow: rng.gen_range(4..=9),
        wit: rng.gen_range(4..=9),
        total: 0,
    };
    let p2 = AxisScore {
        wordplay: rng.gen_range(4..=9),
        shakespeare: rng.gen_range(4..=9),
        flow: rng.gen_range(4..=9),
        wit: rng.gen_range(4..=9),
        total: 0,
    };

    let t1 = p1.wordplay + p1.shakespeare + p1.flow + p1.wit;
    let t2 = p2.wordplay + p2.shakespeare + p2.flow + p2.wit;

    JudgeResult {
        player1_score: AxisScore { total: t1, ..p1 },
        player2_score: AxisScore { total: t2, ..p2 },
        player1_wins: t1 > t2,
        reason: "Judged by the fates of fortune".into(),
    }
}
