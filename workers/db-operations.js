// filename: workers/db-operations.js
/**
 * Cloudflare Worker for Database Operations
 * Purpose: Handle card and deck data storage/retrieval in Cloudflare D1
 * @author: [Your Name]
 * @created: April 28, 2025
 */

export default {
    async fetch(request, env, ctx) {
      try {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // Route handling for different operations
        if (path.startsWith('/api/cards')) {
          return this.handleCardOperations(request, env);
        } else if (path.startsWith('/api/decks')) {
          return this.handleDeckOperations(request, env);
        } else if (path.startsWith('/api/updates')) {
          return this.handleUpdateOperations(request, env);
        }
        
        return new Response("Not found", { status: 404 });
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    },
    
    async handleCardOperations(request, env) {
      const url = new URL(request.url);
      const method = request.method;
      
      // GET operation - retrieve cards (with optional filtering)
      if (method === "GET") {
        const set = url.searchParams.get('set');
        const name = url.searchParams.get('name');
        const type = url.searchParams.get('type');
        
        let query = "SELECT * FROM cards";
        let conditions = [];
        let params = {};
        
        if (set) {
          conditions.push("set = :set");
          params.set = set;
        }
        
        if (name) {
          conditions.push("name LIKE :name");
          params.name = `%${name}%`;
        }
        
        if (type) {
          conditions.push("type = :type");
          params.type = type;
        }
        
        if (conditions.length > 0) {
          query += " WHERE " + conditions.join(" AND ");
        }
        
        const { results } = await env.DB.prepare(query).bind(params).all();
        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // POST operation - add new cards
      if (method === "POST") {
        const data = await request.json();
        
        if (!Array.isArray(data)) {
          return new Response("Expected array of cards", { status: 400 });
        }
        
        const insertPromises = data.map(card => {
          return env.DB.prepare(
            "INSERT INTO cards (name, set, imageFile, setNumber, type, stage, hp, weakness, resistance, retreatCost, rarity, designer, illustrator, script, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            card.name, card.set, card.imageFile, card.setNumber, card.type, card.stage, 
            card.hp, card.weakness, card.resistance, card.retreatCost, card.rarity, 
            card.designer, card.illustrator, card.script, card.text
          ).run();
        });
        
        await Promise.all(insertPromises);
        return new Response(JSON.stringify({ success: true, count: data.length }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Other methods not supported
      return new Response("Method not allowed", { status: 405 });
    },
    
    async handleDeckOperations(request, env) {
      const url = new URL(request.url);
      const method = request.method;
      
      // GET operation - retrieve decks
      if (method === "GET") {
        const id = url.searchParams.get('id');
        const category = url.searchParams.get('category');
        const format = url.searchParams.get('format');
        
        if (id) {
          // Get specific deck by ID
          const { results } = await env.DB.prepare("SELECT * FROM decks WHERE id = ?").bind(id).all();
          if (results.length === 0) {
            return new Response("Deck not found", { status: 404 });
          }
          return new Response(JSON.stringify(results[0]), {
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // Get decks with optional filtering
        let query = "SELECT id, name, category, format, description, created_at FROM decks";
        let conditions = [];
        let params = {};
        
        if (category) {
          conditions.push("category = :category");
          params.category = category;
        }
        
        if (format) {
          conditions.push("format = :format");
          params.format = format;
        }
        
        if (conditions.length > 0) {
          query += " WHERE " + conditions.join(" AND ");
        }
        
        const { results } = await env.DB.prepare(query).bind(params).all();
        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // POST operation - add new deck
      if (method === "POST") {
        const data = await request.json();
        
        if (!data.name || !data.content) {
          return new Response("Missing required fields", { status: 400 });
        }
        
        const { success } = await env.DB.prepare(
          "INSERT INTO decks (name, category, format, description, content) VALUES (?, ?, ?, ?, ?)"
        ).bind(
          data.name, 
          data.category || "Custom", 
          data.format || "Standard", 
          data.description || "", 
          data.content
        ).run();
        
        if (!success) {
          return new Response("Failed to save deck", { status: 500 });
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Other methods not supported
      return new Response("Method not allowed", { status: 405 });
    },
    
    async handleUpdateOperations(request, env) {
      const url = new URL(request.url);
      const method = request.method;
      
      // GET operation - check for updates
      if (method === "GET") {
        const currentVersion = url.searchParams.get('version');
        
        if (!currentVersion) {
          return new Response("Version parameter required", { status: 400 });
        }
        
        const { results } = await env.DB.prepare(
          "SELECT * FROM updates WHERE version > ? ORDER BY version DESC LIMIT 1"
        ).bind(currentVersion).all();
        
        if (results.length === 0) {
          return new Response(JSON.stringify({ updates_available: false }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        
        const latestUpdate = results[0];
        return new Response(JSON.stringify({
          updates_available: true,
          current_version: currentVersion,
          latest_version: latestUpdate.version,
          update_list_url: latestUpdate.update_list_url
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Other methods not supported
      return new Response("Method not allowed", { status: 405 });
    }
  };