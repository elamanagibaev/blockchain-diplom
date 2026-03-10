import logging

from loguru import logger


class InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = "INFO"
        logger_opt = logger.opt(depth=6, exception=record.exc_info)
        logger_opt.log(level, record.getMessage())


def setup_logging() -> None:
    logging.basicConfig(handlers=[InterceptHandler()], level=logging.INFO, force=True)
    logger.add("app.log", rotation="10 MB", retention="7 days", level="INFO")

