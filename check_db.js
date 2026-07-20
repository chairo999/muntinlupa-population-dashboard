const SUPABASE_URL = "https://uaareqlqrkgpmltvrjao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-RZnuhIwEjepuaXPxmrkSg_iZawf7jO";

async function run() {
    try {
        const url = `${SUPABASE_URL}/rest/v1/indicators?select=non_existent_column&apikey=${SUPABASE_ANON_KEY}`;
        const response = await fetch(url, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log("Status:", response.status);
        console.log("Body:", await response.text());
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
