package parser;

import model.ParsedTask;

public interface TaskParser {
    ParsedTask parse(String text, String today);
}
